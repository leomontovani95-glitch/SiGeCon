import { prisma } from "@/lib/db";
import { verifySession, getSchoolFilter } from "@/lib/dal";
import { redirect } from "next/navigation";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { calcularNotaPublicada, faixaNota } from "@/lib/score";
import RankingPDF, { type RankingItem } from "./_components/RankingPDF";

export default async function RelatoriosPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const session = await verifySession();
  if (session.role === "ALUNO") redirect("/acesso-negado");
  const sp = await searchParams;
  const tipo        = sp.tipo        ?? "";
  const status      = sp.status      ?? "";
  const dataInicio  = sp.dataInicio  ?? "";
  const dataFim     = sp.dataFim     ?? "";
  const cursoRanking = sp.cursoRanking ?? "";
  const rankOrdem   = ["asc", "desc", "numAsc", "numDesc"].includes(sp.rankOrdem) ? sp.rankOrdem : "desc";

  const school = getSchoolFilter(session.role, session.escola);

  // ── Filtro de comunicações (tabela) ─────────────────────────────────────
  const where: Record<string, unknown> = {};
  if (school) where.course = { school };
  if (tipo)   where.type   = { name: tipo };
  if (status) {
    switch (status) {
      case "DECIDIDA_PUBLICADA":
        Object.assign(where, { status: "DECIDIDA", disciplinaryBookItems: { some: { disciplinaryBook: { status: "PUBLICADO" } } } });
        break;
      case "DECIDIDA_NAO_PUBLICADA":
        Object.assign(where, {
          status: "DECIDIDA",
          disciplinaryBookItems: { none: { disciplinaryBook: { status: "PUBLICADO" } } },
          decisions: { none: { decisionType: { contains: "rquiv" } } },
        });
        break;
      case "ARQUIVADA_DEC":
        Object.assign(where, { status: "DECIDIDA", decisions: { some: { decisionType: { contains: "rquiv" } } } });
        break;
      default:
        where.status = status;
    }
  }
  if (dataInicio || dataFim) {
    where.factDate = {};
    if (dataInicio) (where.factDate as Record<string, unknown>).gte = new Date(dataInicio);
    if (dataFim)    (where.factDate as Record<string, unknown>).lte = new Date(dataFim);
  }

  // IDs de cursos permitidos pela escola do usuário
  const cursoIds = school
    ? (await prisma.course.findMany({ where: { school }, select: { id: true } })).map((c) => c.id)
    : undefined;

  // ── Queries paralelas ────────────────────────────────────────────────────
  const [comunicacoes, cursos, tipos, rankingStudents, publishedItems] = await Promise.all([
    prisma.communication.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        type: true, student: { include: { course: true } }, reporter: true, decisions: true,
        disciplinaryBookItems: { include: { disciplinaryBook: { select: { status: true } } } },
      },
      take: 200,
    }),
    prisma.course.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.communicationType.findMany({ orderBy: { name: "asc" } }),
    // Alunos para o ranking — filtra por escola e opcionalmente por curso selecionado
    prisma.student.findMany({
      where: {
        status: "ATIVO",
        ...(cursoIds     ? { courseId: { in: cursoIds } }     : {}),
        ...(cursoRanking ? { courseId: cursoRanking }          : {}),
      },
      include: { course: true, platoon: true },
    }),
    // Itens de cadernos PUBLICADOS — base das notas
    prisma.disciplinaryBookItem.findMany({
      where: {
        disciplinaryBook: { status: "PUBLICADO" },
        ...(cursoIds     ? { courseId: { in: cursoIds } }     : {}),
        ...(cursoRanking ? { courseId: cursoRanking }          : {}),
      },
      include: {
        communication: { include: { type: { select: { scoreNature: true } } } },
      },
    }),
  ]);

  // Agrupa itens publicados por aluno para cálculo eficiente
  const pubPorAluno = new Map<string, typeof publishedItems>();
  for (const item of publishedItems) {
    if (!pubPorAluno.has(item.studentId)) pubPorAluno.set(item.studentId, []);
    pubPorAluno.get(item.studentId)!.push(item);
  }

  const ranking: RankingItem[] = rankingStudents
    .map((a) => ({
      warName:      a.warName,
      fullName:     a.fullName,
      courseNumber: a.courseNumber,
      courseName:   a.course.name,
      platoonName:  a.platoon?.name ?? null,
      nota:         calcularNotaPublicada(pubPorAluno.get(a.id) ?? []),
    }))
    .sort((a, b) => {
      if (rankOrdem === "numAsc" || rankOrdem === "numDesc") {
        const na = parseInt(a.courseNumber, 10) || 0;
        const nb = parseInt(b.courseNumber, 10) || 0;
        return rankOrdem === "numAsc" ? na - nb : nb - na;
      }
      return rankOrdem === "asc" ? a.nota - b.nota : b.nota - a.nota;
    });

  const total         = comunicacoes.length;
  const desfavoraveis = comunicacoes.filter((c) => c.type.scoreNature === "DESFAVORAVEL").length;
  const favoraveis    = comunicacoes.filter((c) => c.type.scoreNature === "FAVORAVEL").length;
  const decididas     = comunicacoes.filter((c) => c.status === "DECIDIDA").length;

  // Links de ordenação preservando todos os parâmetros
  const paramsBase = new URLSearchParams({ tipo, status, dataInicio, dataFim, cursoRanking });
  const mkLink = (ordem: string) => `?${new URLSearchParams({ ...Object.fromEntries(paramsBase), rankOrdem: ordem })}`;

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Relatórios</h1>
      </div>

      {/* Filtros de comunicações */}
      <form method="GET" className="bg-white rounded-xl border border-gray-200 p-5 mb-6 flex flex-wrap gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Tipo</label>
          <select name="tipo" defaultValue={tipo} className="input text-sm">
            <option value="">Todos</option>
            {tipos.map((t) => <option key={t.id} value={t.name}>{t.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
          <select name="status" defaultValue={status} className="input text-sm">
            <option value="">Todos</option>
            <option value="AGUARDANDO_CIENCIA">Ag. Ciência/Defesa</option>
            <option value="PRAZO_EXPIRADO">Prazo Expirado</option>
            <option value="JUSTIFICATIVA_APRESENTADA">Defesa Apresentada</option>
            <option value="AGUARDANDO_PARECER">Ag. Parecer</option>
            <option value="AGUARDANDO_DECISAO">Ag. Decisão</option>
            <option value="DECIDIDA_PUBLICADA">Decidida/Publicada</option>
            <option value="DECIDIDA_NAO_PUBLICADA">Decidida/Não publicada</option>
            <option value="ARQUIVADA_DEC">Arquivada</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Data início</label>
          <input name="dataInicio" type="date" defaultValue={dataInicio} className="input text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Data fim</label>
          <input name="dataFim" type="date" defaultValue={dataFim} className="input text-sm" />
        </div>
        {/* Preserva o filtro de ranking ao submeter este formulário */}
        <input type="hidden" name="cursoRanking" value={cursoRanking} />
        <input type="hidden" name="rankOrdem"    value={rankOrdem} />
        <div className="flex items-end">
          <button type="submit" className="btn-primary">Filtrar</button>
        </div>
      </form>

      {/* Cards resumo */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: "Total",          value: total,         color: "bg-blue-600" },
          { label: "Desfavoráveis",  value: desfavoraveis, color: "bg-red-600" },
          { label: "Favoráveis",     value: favoraveis,    color: "bg-green-600" },
          { label: "Decididas",      value: decididas,     color: "bg-teal-600" },
        ].map((card) => (
          <div key={card.label} className={`${card.color} rounded-xl p-4 text-white`}>
            <p className="text-2xl font-bold">{card.value}</p>
            <p className="text-xs mt-1 opacity-90">{card.label}</p>
          </div>
        ))}
      </div>

      {/* Tabela de comunicações */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto mb-10">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-700">Protocolo</th>
              <th className="text-left px-4 py-3 font-medium text-gray-700">Tipo</th>
              <th className="text-left px-4 py-3 font-medium text-gray-700">Aluno</th>
              <th className="text-left px-4 py-3 font-medium text-gray-700">Curso</th>
              <th className="text-left px-4 py-3 font-medium text-gray-700">Data</th>
              <th className="text-left px-4 py-3 font-medium text-gray-700">Status</th>
              <th className="text-left px-4 py-3 font-medium text-gray-700">Pont.</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {comunicacoes.map((c) => (
              <tr key={c.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-mono text-xs">{c.protocolNumber}</td>
                <td className="px-4 py-3 text-xs">{c.type.name}</td>
                <td className="px-4 py-3 font-medium text-gray-900">{c.student.warName}</td>
                <td className="px-4 py-3 text-xs text-gray-500">{c.student.course.name}</td>
                <td className="px-4 py-3 text-xs text-gray-500">{format(new Date(c.factDate), "dd/MM/yyyy", { locale: ptBR })}</td>
                <td className="px-4 py-3 text-xs">{(() => {
                  if (c.status === "DECIDIDA") {
                    const arq = c.decisions.some((d) => d.decisionType.toLowerCase().includes("arquiv"));
                    if (arq) return "Arquivada";
                    const pub = c.disciplinaryBookItems.some((i) => i.disciplinaryBook.status === "PUBLICADO");
                    return pub ? "Decidida/Publicada" : "Decidida/Não publicada";
                  }
                  return c.status.replace(/_/g, " ");
                })()}</td>
                <td className="px-4 py-3 text-xs font-bold">{c.finalScore != null ? c.finalScore.toFixed(1) : "—"}</td>
              </tr>
            ))}
            {comunicacoes.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">Nenhuma comunicação encontrada.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ── Ranking de Conduta ─────────────────────────────────────────────── */}
      <div>
        <div className="flex items-start justify-between mb-4 flex-wrap gap-3">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Ranking de Conduta</h2>
            <p className="text-sm text-gray-500">
              {ranking.length} aluno(s) · notas baseadas nos cadernos publicados
              {cursoRanking && cursos.find(c => c.id === cursoRanking) && (
                <span className="ml-2 font-medium text-[#1e3a5f]">
                  — {cursos.find(c => c.id === cursoRanking)!.name}
                </span>
              )}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Filtro de curso para o ranking */}
            <form method="GET" className="flex items-center gap-2">
              <input type="hidden" name="tipo"       value={tipo} />
              <input type="hidden" name="status"     value={status} />
              <input type="hidden" name="dataInicio" value={dataInicio} />
              <input type="hidden" name="dataFim"    value={dataFim} />
              <input type="hidden" name="rankOrdem"  value={rankOrdem} />
              <select
                name="cursoRanking"
                defaultValue={cursoRanking}
                className="input text-sm py-1.5 pr-8"
              >
                <option value="">Todos os cursos</option>
                {cursos.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <button type="submit" className="btn-primary py-1.5 px-3 text-sm">Filtrar</button>
            </form>

            {/* Ordenação */}
            <div className="flex flex-wrap gap-2 text-xs font-medium">
              <div className="flex rounded-lg overflow-hidden border border-gray-200">
                <a href={mkLink("desc")} className={`px-3 py-2 transition-colors ${rankOrdem === "desc" ? "bg-[#1e3a5f] text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}>
                  Nota ↓
                </a>
                <a href={mkLink("asc")} className={`px-3 py-2 transition-colors border-l border-gray-200 ${rankOrdem === "asc" ? "bg-[#1e3a5f] text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}>
                  Nota ↑
                </a>
              </div>
              <div className="flex rounded-lg overflow-hidden border border-gray-200">
                <a href={mkLink("numAsc")} className={`px-3 py-2 transition-colors ${rankOrdem === "numAsc" ? "bg-[#1e3a5f] text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}>
                  Nº ↑
                </a>
                <a href={mkLink("numDesc")} className={`px-3 py-2 transition-colors border-l border-gray-200 ${rankOrdem === "numDesc" ? "bg-[#1e3a5f] text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}>
                  Nº ↓
                </a>
              </div>
            </div>

            <RankingPDF ranking={ranking} />
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[#1e3a5f] text-white">
              <tr>
                <th className="text-center px-3 py-3 font-medium w-12">Pos.</th>
                <th className="text-left px-3 py-3 font-medium w-16">Nº</th>
                <th className="text-left px-3 py-3 font-medium">Nome de Guerra</th>
                <th className="text-left px-3 py-3 font-medium">Curso</th>
                <th className="text-left px-3 py-3 font-medium">Pelotão</th>
                <th className="text-center px-3 py-3 font-medium w-20">Nota</th>
                <th className="text-left px-3 py-3 font-medium w-28">Classificação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {ranking.map((a, i) => {
                const faixa = faixaNota(a.nota);
                return (
                  <tr key={i} className={i % 2 === 0 ? "bg-white hover:bg-gray-50" : "bg-gray-50 hover:bg-gray-100"}>
                    <td className="px-3 py-2.5 text-center text-xs font-bold text-gray-500">{i + 1}º</td>
                    <td className="px-3 py-2.5 font-mono text-xs text-gray-600">{a.courseNumber}</td>
                    <td className="px-3 py-2.5 font-semibold text-gray-900">{a.warName}</td>
                    <td className="px-3 py-2.5 text-xs text-gray-600">{a.courseName}</td>
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
              {ranking.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">Nenhum aluno ativo encontrado.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
