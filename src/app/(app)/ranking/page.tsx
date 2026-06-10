import { prisma } from "@/lib/db";
import { verifySession, getSchoolFilter } from "@/lib/dal";
import { redirect } from "next/navigation";
import { calcularNotaPublicada, faixaNota } from "@/lib/score";
import Link from "next/link";

const PER_PAGE = 50;
const ORDENS_VALIDAS = ["desc", "asc", "numAsc", "numDesc"] as const;
type Ordem = typeof ORDENS_VALIDAS[number];

export default async function RankingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const session = await verifySession();
  if (session.role === "ALUNO") redirect("/acesso-negado");

  const sp = await searchParams;
  const cursoId = sp.cursoId ?? "";
  const ordem: Ordem = ORDENS_VALIDAS.includes(sp.ordem as Ordem) ? (sp.ordem as Ordem) : "desc";
  const pagina = Math.max(1, parseInt(sp.pagina ?? "1") || 1);
  const busca = (sp.busca ?? "").trim().toLowerCase();

  const school = getSchoolFilter(session.role, session.escola);

  // Cursos disponíveis para o seletor
  const cursosDisponiveis = await prisma.course.findMany({
    where: { active: true, ...(school ? { school } : {}) },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  // IDs no escopo
  const scopeIds = cursoId
    ? [cursoId]
    : cursosDisponiveis.map((c) => c.id);

  const [rankingStudents, publishedItems] = await Promise.all([
    prisma.student.findMany({
      where: { status: "ATIVO", courseId: { in: scopeIds } },
      include: { course: true, platoon: true },
    }),
    prisma.disciplinaryBookItem.findMany({
      where: {
        disciplinaryBook: { status: "PUBLICADO" },
        courseId: { in: scopeIds },
      },
      include: {
        communication: { include: { type: { select: { scoreNature: true } } } },
      },
    }),
  ]);

  // Agrupa itens publicados por aluno
  const pubPorAluno = new Map<string, typeof publishedItems>();
  for (const item of publishedItems) {
    if (!pubPorAluno.has(item.studentId)) pubPorAluno.set(item.studentId, []);
    pubPorAluno.get(item.studentId)!.push(item);
  }

  const ranking = rankingStudents
    .map((a) => ({
      id:           a.id,
      warName:      a.warName,
      fullName:     a.fullName,
      courseNumber: a.courseNumber,
      courseName:   a.course.name,
      platoonName:  a.platoon?.name ?? null,
      nota:         calcularNotaPublicada(pubPorAluno.get(a.id) ?? []),
    }))
    .sort((a, b) => {
      if (ordem === "numAsc" || ordem === "numDesc") {
        const na = parseInt(a.courseNumber, 10) || 0;
        const nb = parseInt(b.courseNumber, 10) || 0;
        return ordem === "numAsc" ? na - nb : nb - na;
      }
      return ordem === "asc" ? a.nota - b.nota : b.nota - a.nota;
    });

  const rankingFiltrado = busca
    ? ranking.filter(
        (a) =>
          a.warName.toLowerCase().includes(busca) ||
          a.courseNumber.includes(busca)
      )
    : ranking;

  const totalAlunos  = rankingFiltrado.length;
  const totalPaginas = Math.max(1, Math.ceil(totalAlunos / PER_PAGE));
  const paginaAtual  = Math.min(pagina, totalPaginas);
  const inicio       = (paginaAtual - 1) * PER_PAGE;
  const paginaItems  = rankingFiltrado.slice(inicio, inicio + PER_PAGE);

  const cursoSelecionado = cursosDisponiveis.find((c) => c.id === cursoId);
  const labelEscopo = school === "ESFAP" ? "Todos da EsFAP"
    : school === "ESFO"  ? "Todos da EsFO"
    : "Todos os cursos";

  // Constrói URL preservando os params atuais
  function mkUrl(overrides: Record<string, string | number>) {
    const p = new URLSearchParams();
    if (cursoId) p.set("cursoId", cursoId);
    p.set("ordem", ordem);
    p.set("pagina", String(paginaAtual));
    if (busca) p.set("busca", busca);
    for (const [k, v] of Object.entries(overrides)) p.set(k, String(v));
    return `/ranking?${p.toString()}`;
  }

  // Janela de páginas: sempre mostra até 7 botões centrados na página atual
  function buildPageWindow() {
    const WINDOW = 7;
    let start = Math.max(1, paginaAtual - Math.floor(WINDOW / 2));
    let end   = start + WINDOW - 1;
    if (end > totalPaginas) { end = totalPaginas; start = Math.max(1, end - WINDOW + 1); }
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  }

  return (
    <div className="p-6">
      {/* Título */}
      <div className="flex items-start justify-between mb-5 flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Ranking de Conduta</h1>
          <p className="text-sm text-gray-500">
            {cursoSelecionado ? cursoSelecionado.name : labelEscopo}
            {" · "}{totalAlunos} aluno(s)
            {" · "}notas baseadas nos cadernos publicados
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href={`/ranking/imprimir${cursoId ? `?cursoId=${cursoId}` : ""}`}
            target="_blank"
            className="bg-[#1e3a5f] text-white px-4 py-2 rounded-lg text-sm hover:bg-[#16304f] transition-colors flex items-center gap-2"
          >
            <span>📄</span> Gerar PDF
          </Link>
          <a
            href={`/api/export/ranking${cursoId ? `?cursoId=${cursoId}` : ""}`}
            className="border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm hover:bg-gray-50 transition-colors flex items-center gap-2"
          >
            <span>⬇</span> Exportar CSV
          </a>
        </div>
      </div>

      {/* Campo de busca */}
      <form method="GET" action="/ranking" className="mb-5">
        {cursoId && <input type="hidden" name="cursoId" value={cursoId} />}
        <input type="hidden" name="ordem" value={ordem} />
        <div className="flex gap-2">
          <input
            name="busca"
            type="search"
            defaultValue={busca}
            placeholder="Buscar por nome de guerra ou número..."
            className="input flex-1 max-w-sm"
          />
          <button type="submit" className="btn-primary px-4">Buscar</button>
          {busca && (
            <a href={mkUrl({ busca: "", pagina: 1 })} className="btn-secondary px-4">
              Limpar
            </a>
          )}
        </div>
        {busca && (
          <p className="text-xs text-gray-500 mt-1">
            {totalAlunos} resultado(s) para &quot;{busca}&quot;
          </p>
        )}
      </form>

      {/* Seletor de cursos */}
      {cursosDisponiveis.length > 1 && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-5">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Filtrar por curso</p>
          <div className="flex flex-wrap gap-2">
            <Link
              href={mkUrl({ cursoId: "", pagina: 1 })}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                !cursoId ? "bg-[#1e3a5f] text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              {labelEscopo}
            </Link>
            {cursosDisponiveis.map((curso) => (
              <Link
                key={curso.id}
                href={mkUrl({ cursoId: curso.id, pagina: 1 })}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  cursoId === curso.id ? "bg-[#1e3a5f] text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                {curso.name}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Controles de ordenação */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 font-medium">Ordenar por:</span>
          <div className="flex rounded-lg overflow-hidden border border-gray-200 text-xs font-medium">
            <Link href={mkUrl({ ordem: "desc", pagina: 1 })}
              className={`px-3 py-2 transition-colors ${ordem === "desc" ? "bg-[#1e3a5f] text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}>
              Nota ↓
            </Link>
            <Link href={mkUrl({ ordem: "asc", pagina: 1 })}
              className={`px-3 py-2 transition-colors border-l border-gray-200 ${ordem === "asc" ? "bg-[#1e3a5f] text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}>
              Nota ↑
            </Link>
            <Link href={mkUrl({ ordem: "numAsc", pagina: 1 })}
              className={`px-3 py-2 transition-colors border-l border-gray-200 ${ordem === "numAsc" ? "bg-[#1e3a5f] text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}>
              Nº ↑
            </Link>
            <Link href={mkUrl({ ordem: "numDesc", pagina: 1 })}
              className={`px-3 py-2 transition-colors border-l border-gray-200 ${ordem === "numDesc" ? "bg-[#1e3a5f] text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}>
              Nº ↓
            </Link>
          </div>
        </div>

        {totalPaginas > 1 && (
          <p className="text-xs text-gray-500">
            Página <strong>{paginaAtual}</strong> de <strong>{totalPaginas}</strong>
            {" · "}mostrando {inicio + 1}–{Math.min(inicio + PER_PAGE, totalAlunos)} de {totalAlunos}
          </p>
        )}
      </div>

      {/* Tabela */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto mb-5">
        <table className="w-full text-sm">
          <thead className="bg-[#1e3a5f] text-white">
            <tr>
              <th className="text-center px-3 py-3 font-medium w-12">Pos.</th>
              <th className="text-left px-3 py-3 font-medium w-16">Nº</th>
              <th className="text-left px-3 py-3 font-medium">Nome de Guerra</th>
              {!cursoId && cursosDisponiveis.length > 1 && (
                <th className="text-left px-3 py-3 font-medium">Curso</th>
              )}
              <th className="text-left px-3 py-3 font-medium">Pelotão</th>
              <th className="text-center px-3 py-3 font-medium w-20">Nota</th>
              <th className="text-left px-3 py-3 font-medium w-28">Classificação</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {paginaItems.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                  Nenhum aluno ativo encontrado.
                </td>
              </tr>
            )}
            {paginaItems.map((a, i) => {
              const posicaoGlobal = inicio + i + 1;
              const faixa = faixaNota(a.nota);
              return (
                <tr
                  key={`${a.courseNumber}-${a.warName}`}
                  className={i % 2 === 0 ? "bg-white hover:bg-gray-50" : "bg-gray-50 hover:bg-gray-100"}
                >
                  <td className="px-3 py-2.5 text-center text-xs font-bold text-gray-500">
                    {posicaoGlobal}º
                  </td>
                  <td className="px-3 py-2.5 font-mono text-xs text-gray-600">{a.courseNumber}</td>
                  <td className="px-3 py-2.5 font-semibold text-gray-900">
                    <Link href={`/alunos/${a.id}`} className="hover:text-[#1e3a5f] hover:underline">{a.warName}</Link>
                  </td>
                  {!cursoId && cursosDisponiveis.length > 1 && (
                    <td className="px-3 py-2.5 text-xs text-gray-600">{a.courseName}</td>
                  )}
                  <td className="px-3 py-2.5 text-xs text-gray-500">{a.platoonName ?? "—"}</td>
                  <td className="px-3 py-2.5 text-center">
                    <span className={`inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-xs font-bold ${faixa.tailwind}`}>
                      {a.nota.toFixed(2)}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-xs text-gray-700">{faixa.label}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Paginação */}
      {totalPaginas > 1 && (
        <div className="flex items-center justify-center gap-1 flex-wrap">
          {/* Anterior */}
          {paginaAtual > 1 ? (
            <Link href={mkUrl({ pagina: paginaAtual - 1 })}
              className="px-3 py-1.5 rounded-lg text-sm font-medium bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors">
              ← Anterior
            </Link>
          ) : (
            <span className="px-3 py-1.5 rounded-lg text-sm font-medium bg-gray-50 border border-gray-200 text-gray-300 cursor-not-allowed">
              ← Anterior
            </span>
          )}

          {/* Primeira página + reticências */}
          {buildPageWindow()[0] > 1 && (
            <>
              <Link href={mkUrl({ pagina: 1 })}
                className="px-3 py-1.5 rounded-lg text-sm font-medium bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors">
                1
              </Link>
              {buildPageWindow()[0] > 2 && (
                <span className="px-2 py-1.5 text-sm text-gray-400">…</span>
              )}
            </>
          )}

          {/* Janela de páginas */}
          {buildPageWindow().map((p) => (
            <Link
              key={p}
              href={mkUrl({ pagina: p })}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                p === paginaAtual
                  ? "bg-[#1e3a5f] text-white border-[#1e3a5f]"
                  : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50"
              }`}
            >
              {p}
            </Link>
          ))}

          {/* Última página + reticências */}
          {buildPageWindow().at(-1)! < totalPaginas && (
            <>
              {buildPageWindow().at(-1)! < totalPaginas - 1 && (
                <span className="px-2 py-1.5 text-sm text-gray-400">…</span>
              )}
              <Link href={mkUrl({ pagina: totalPaginas })}
                className="px-3 py-1.5 rounded-lg text-sm font-medium bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors">
                {totalPaginas}
              </Link>
            </>
          )}

          {/* Próxima */}
          {paginaAtual < totalPaginas ? (
            <Link href={mkUrl({ pagina: paginaAtual + 1 })}
              className="px-3 py-1.5 rounded-lg text-sm font-medium bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors">
              Próxima →
            </Link>
          ) : (
            <span className="px-3 py-1.5 rounded-lg text-sm font-medium bg-gray-50 border border-gray-200 text-gray-300 cursor-not-allowed">
              Próxima →
            </span>
          )}
        </div>
      )}
    </div>
  );
}
