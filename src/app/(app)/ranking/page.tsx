import { prisma } from "@/lib/db";
import { verifySession, getSchoolFilter } from "@/lib/dal";
import { normalizeSituacaoCurso, activeWhereCurso, studentStatusWhere, buildSituacaoOptions } from "@/lib/cursos";
import SituacaoCursoFilter from "@/components/SituacaoCursoFilter";
import { redirect } from "next/navigation";
import { calcularNotaPublicada, faixaNota } from "@/lib/score";
import { abreviarPelotao } from "@/lib/utils";
import Link from "next/link";
import FaixaNotaChart from "./_components/FaixaNotaChart";
import { compararRanking, normalizarOrdemRanking, type OrdemRanking } from "@/lib/ranking-ordem";

const PER_PAGE = 50;

export default async function RankingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const session = await verifySession();
  if (session.role === "ALUNO") redirect("/acesso-negado");

  const sp = await searchParams;
  const cursoId = sp.cursoId ?? "";
  const ordem: OrdemRanking = normalizarOrdemRanking(sp.ordem);
  const pagina = Math.max(1, parseInt(sp.pagina ?? "1") || 1);
  const busca = (sp.busca ?? "").trim().toLowerCase();
  const situacao = normalizeSituacaoCurso(sp.situacao);

  const school = getSchoolFilter(session.role, session.escola);

  // Cursos disponíveis para o seletor (filtra por situação: ativos/inativos/todos)
  const cursosDisponiveis = await prisma.course.findMany({
    where: { ...activeWhereCurso(situacao), ...(school ? { school } : {}) },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  // IDs no escopo
  const scopeIds = cursoId
    ? [cursoId]
    : cursosDisponiveis.map((c) => c.id);

  // Alunos de cursos inativos ficam INATIVO; o status acompanha a situação do curso.
  const rankingStudents = await prisma.student.findMany({
    where: { ...studentStatusWhere(situacao), courseId: { in: scopeIds } },
    include: { course: true, platoon: true },
  });
  // Notas agregadas por aluno (studentId), não por curso: assim o histórico de
  // um aluno transferido como remanescente acompanha-o no novo curso, enquanto
  // um novo cadastro (outro Student) inicia com histórico zerado (nota 10).
  const publishedItems = await prisma.disciplinaryBookItem.findMany({
    where: {
      disciplinaryBook: { status: "PUBLICADO" },
      studentId: { in: rankingStudents.map((s) => s.id) },
    },
    include: {
      communication: { include: { type: { select: { scoreNature: true } } } },
    },
  });

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
    .sort(compararRanking(ordem));

  const FAIXAS_CORES: Record<string, string> = {
    Excelente: "#166534",
    Bom:       "#16a34a",
    Regular:   "#ca8a04",
    Atenção:   "#f87171",
    Reprovado: "#b91c1c",
  };
  const faixaCount: Record<string, number> = { Excelente: 0, Bom: 0, Regular: 0, Atenção: 0, Reprovado: 0 };
  for (const a of ranking) faixaCount[faixaNota(a.nota).label]++;
  const faixaNotaData = (["Excelente", "Bom", "Regular", "Atenção", "Reprovado"] as const).map(
    (faixa) => ({ faixa, quantidade: faixaCount[faixa], cor: FAIXAS_CORES[faixa] }),
  );

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
    if (situacao !== "ativos") p.set("situacao", situacao);
    for (const [k, v] of Object.entries(overrides)) {
      if (v === "") p.delete(k); else p.set(k, String(v));
    }
    return `/ranking?${p.toString()}`;
  }

  // Trocar a situação reinicia curso/página (curso pode não existir na outra lista).
  const situacaoOptions = buildSituacaoOptions(situacao, (k) =>
    mkUrl({ situacao: k === "ativos" ? "" : k, cursoId: "", pagina: 1 }),
  );

  // Janela de páginas: sempre mostra até 7 botões centrados na página atual
  function buildPageWindow() {
    const WINDOW = 7;
    let start = Math.max(1, paginaAtual - Math.floor(WINDOW / 2));
    let end   = start + WINDOW - 1;
    if (end > totalPaginas) { end = totalPaginas; start = Math.max(1, end - WINDOW + 1); }
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  }

  // Cabeçalho de coluna clicável: alterna asc/desc e mostra a seta na coluna ativa
  // (↑ asc, ↓ desc, ↕ inativa). Chamado como função (padrão do projeto).
  function thOrdenavel(label: string, asc: OrdemRanking, desc: OrdemRanking, className = "") {
    const isAsc = ordem === asc;
    const isDesc = ordem === desc;
    const proxima = isAsc ? desc : asc; // inativa→asc, asc→desc, desc→asc
    const seta = isAsc ? "↑" : isDesc ? "↓" : "↕";
    return (
      <th className={`px-3 py-3 font-medium ${className}`}>
        <Link
          href={mkUrl({ ordem: proxima, pagina: 1 })}
          className="inline-flex items-center gap-1 hover:underline focus:outline-none focus:ring-2 focus:ring-blue-300 rounded"
          aria-label={`Ordenar por ${label}`}
        >
          <span>{label}</span>
          <span aria-hidden="true" className={isAsc || isDesc ? "opacity-100" : "opacity-40"}>{seta}</span>
        </Link>
      </th>
    );
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
            href={`/ranking/imprimir?ordem=${ordem}${cursoId ? `&cursoId=${cursoId}` : ""}${situacao !== "ativos" ? `&situacao=${situacao}` : ""}`}
            target="_blank"
            className="bg-[#1e3a5f] text-white px-4 py-2 rounded-lg text-sm hover:bg-[#16304f] transition-colors flex items-center gap-2"
          >
            <span>📄</span> Gerar PDF
          </Link>
          <a
            href={`/api/export/ranking?${new URLSearchParams({ ...(cursoId ? { cursoId } : {}), ...(situacao !== "ativos" ? { situacao } : {}) }).toString()}`}
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
        {situacao !== "ativos" && <input type="hidden" name="situacao" value={situacao} />}
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

      {/* Situação do curso + Seletor de cursos (mesma barra de filtros) */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-5 space-y-4">
        <SituacaoCursoFilter options={situacaoOptions} />
        {cursosDisponiveis.length > 1 && (
          <div className="border-t border-gray-100 pt-4">
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
                  href={mkUrl({ cursoId: cursoId === curso.id ? "" : curso.id, pagina: 1 })}
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
      </div>

      {situacao === "todos" && (
        <p className="text-xs text-gray-500 mb-4 -mt-1">
          Em <strong>Todos</strong>, um aluno que mudou de curso pode aparecer mais de uma vez — uma linha por
          matrícula (ativa e anteriores), cada uma com seu próprio histórico de conduta.
        </p>
      )}

      {/* Distribuição por faixa de nota */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-5">
        <h2 className="text-sm font-semibold text-gray-900 mb-0.5">Distribuição por Faixa de Nota</h2>
        <p className="text-xs text-gray-500 mb-4">
          {ranking.length} aluno(s) · notas baseadas nos cadernos publicados
        </p>
        <FaixaNotaChart data={faixaNotaData} />
      </div>

      {/* Info de paginação (a ordenação agora é feita clicando nos cabeçalhos da tabela) */}
      {totalPaginas > 1 && (
        <div className="flex justify-end mb-4">
          <p className="text-xs text-gray-500">
            Página <strong>{paginaAtual}</strong> de <strong>{totalPaginas}</strong>
            {" · "}mostrando {inicio + 1}–{Math.min(inicio + PER_PAGE, totalAlunos)} de {totalAlunos}
          </p>
        </div>
      )}

      {/* Tabela */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto mb-5">
        <table className="w-full text-sm">
          <thead className="bg-[#1e3a5f] text-white">
            <tr>
              <th className="text-center px-3 py-3 font-medium w-12">Pos.</th>
              {thOrdenavel("Nº", "numAsc", "numDesc", "text-left w-16")}
              {thOrdenavel("Nome de Guerra", "nomeAsc", "nomeDesc", "text-left")}
              {!cursoId && cursosDisponiveis.length > 1 &&
                thOrdenavel("Curso", "cursoAsc", "cursoDesc", "text-left")}
              {thOrdenavel("Pelotão", "pelAsc", "pelDesc", "text-left")}
              {thOrdenavel("Nota", "asc", "desc", "text-center w-20")}
              {thOrdenavel("Classificação", "classAsc", "classDesc", "text-left w-28")}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {paginaItems.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                  Nenhum aluno encontrado.
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
                  <td className="px-3 py-2.5 text-xs text-gray-500 whitespace-nowrap">{abreviarPelotao(a.platoonName)}</td>
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
