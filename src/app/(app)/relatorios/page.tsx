import { prisma } from "@/lib/db";
import { verifySession, getSchoolFilter } from "@/lib/dal";
import { redirect } from "next/navigation";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import Link from "next/link";

function resolveStatusLabel(c: {
  status: string;
  decisions: { decisionType: string }[];
  disciplinaryBookItems: { disciplinaryBook: { status: string } }[];
}): string {
  // Status legado: equivale a Decidida/Publicada
  if (c.status === "PUBLICADA_CADERNO") return "Decidida/Publicada";
  if (c.status === "DECIDIDA") {
    const arq = c.decisions.some((d) => d.decisionType.toLowerCase().includes("arquiv"));
    if (arq) return "Arquivada";
    const pub = c.disciplinaryBookItems.some((i) => i.disciplinaryBook.status === "PUBLICADO");
    return pub ? "Decidida/Publicada" : "Decidida/Não publicada";
  }
  const map: Record<string, string> = {
    AGUARDANDO_CIENCIA:          "Ag. Ciência/Defesa",
    AGUARDANDO_DEFESA:           "Ag. Ciência/Defesa",
    PRAZO_EXPIRADO:              "Prazo Expirado",
    JUSTIFICATIVA_APRESENTADA:   "Defesa Apresentada",
    AGUARDANDO_PARECER:          "Ag. Parecer",
    AGUARDANDO_DECISAO:          "Ag. Decisão",
    ARQUIVADA:                   "Arquivada",
  };
  return map[c.status] ?? c.status.replace(/_/g, " ");
}

export default async function RelatoriosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const session = await verifySession();
  if (session.role === "ALUNO") redirect("/acesso-negado");

  const sp = await searchParams;
  const cursoId    = sp.cursoId    ?? "";
  const tipo       = sp.tipo       ?? "";
  const status     = sp.status     ?? "";
  const dataInicio = sp.dataInicio ?? "";
  const dataFim    = sp.dataFim    ?? "";

  const school = getSchoolFilter(session.role, session.escola);

  // Cursos disponíveis para o seletor
  const cursosDisponiveis = await prisma.course.findMany({
    where: { active: true, ...(school ? { school } : {}) },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  // Filtro de escola/curso
  const cursoFilter = cursoId
    ? { courseId: cursoId }
    : school
      ? { course: { school } }
      : {};

  const where: Record<string, unknown> = { ...cursoFilter };

  if (tipo) where.type = { name: tipo };

  if (status) {
    switch (status) {
      case "DECIDIDA_PUBLICADA":
        Object.assign(where, {
          OR: [
            { status: "PUBLICADA_CADERNO" },
            { status: "DECIDIDA", disciplinaryBookItems: { some: { disciplinaryBook: { status: "PUBLICADO" } } } },
          ],
        });
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

  const [comunicacoes, tipos] = await Promise.all([
    prisma.communication.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        type: true,
        student: { include: { course: true } },
        reporter: true,
        decisions: true,
        disciplinaryBookItems: { include: { disciplinaryBook: { select: { status: true } } } },
      },
      take: 200,
    }),
    prisma.communicationType.findMany({ orderBy: { name: "asc" } }),
  ]);

  const total         = comunicacoes.length;
  const desfavoraveis = comunicacoes.filter((c) => c.type.scoreNature === "DESFAVORAVEL").length;
  const favoraveis    = comunicacoes.filter((c) => c.type.scoreNature === "FAVORAVEL").length;

  const cursoSelecionado = cursosDisponiveis.find((c) => c.id === cursoId);
  const labelEscopo = school === "ESFAP" ? "Todos da EsFAP"
    : school === "ESFO"  ? "Todos da EsFO"
    : "Todos os cursos";

  // URL dos pills preservando os filtros atuais
  function pillHref(id: string) {
    const p = new URLSearchParams();
    if (id)          p.set("cursoId",    id);
    if (tipo)        p.set("tipo",       tipo);
    if (status)      p.set("status",     status);
    if (dataInicio)  p.set("dataInicio", dataInicio);
    if (dataFim)     p.set("dataFim",    dataFim);
    const qs = p.toString();
    return `/relatorios${qs ? `?${qs}` : ""}`;
  }

  // Link para página de impressão preservando filtros ativos
  function pdfHref() {
    const p = new URLSearchParams();
    if (cursoId)    p.set("cursoId",    cursoId);
    if (tipo)       p.set("tipo",       tipo);
    if (status)     p.set("status",     status);
    if (dataInicio) p.set("dataInicio", dataInicio);
    if (dataFim)    p.set("dataFim",    dataFim);
    const qs = p.toString();
    return `/relatorios/imprimir${qs ? `?${qs}` : ""}`;
  }

  return (
    <div className="p-6">
      {/* Título */}
      <div className="flex items-start justify-between mb-5 flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Relatórios</h1>
          <p className="text-sm text-gray-500">
            {cursoSelecionado ? cursoSelecionado.name : labelEscopo}
            {" · "}{total} resultado(s)
          </p>
        </div>
        <Link href={pdfHref()} target="_blank" className="bg-[#1e3a5f] text-white px-4 py-2 rounded-lg text-sm hover:bg-[#16304f] transition-colors flex items-center gap-2">
          <span>📄</span> Gerar PDF
        </Link>
      </div>

      {/* Seletor de cursos */}
      {cursosDisponiveis.length > 1 && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-5">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Filtrar por curso</p>
          <div className="flex flex-wrap gap-2">
            <Link
              href={pillHref("")}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                !cursoId ? "bg-[#1e3a5f] text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              {labelEscopo}
            </Link>
            {cursosDisponiveis.map((curso) => (
              <Link
                key={curso.id}
                href={pillHref(curso.id)}
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

      {/* Filtros */}
      <form method="GET" className="bg-white rounded-xl border border-gray-200 p-5 mb-6 flex flex-wrap gap-4">
        {cursoId && <input type="hidden" name="cursoId" value={cursoId} />}
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
        <div className="flex items-end">
          <button type="submit" className="btn-primary">Filtrar</button>
        </div>
      </form>

      {/* Cards resumo */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Total",          value: total,         color: "bg-blue-600" },
          { label: "Desfavoráveis",  value: desfavoraveis, color: "bg-red-600" },
          { label: "Favoráveis",     value: favoraveis,    color: "bg-green-600" },
          { label: "Decididas",      value: comunicacoes.filter((c) => c.status === "DECIDIDA").length, color: "bg-teal-600" },
        ].map((card) => (
          <div key={card.label} className={`${card.color} rounded-xl p-4 text-white`}>
            <p className="text-2xl font-bold">{card.value}</p>
            <p className="text-xs mt-1 opacity-90">{card.label}</p>
          </div>
        ))}
      </div>

      {/* Tabela */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-3 py-2.5 font-medium text-gray-700 text-xs whitespace-nowrap">Protocolo</th>
              <th className="text-left px-3 py-2.5 font-medium text-gray-700 text-xs whitespace-nowrap">Tipo</th>
              <th className="text-left px-3 py-2.5 font-medium text-gray-700 text-xs whitespace-nowrap">Aluno</th>
              <th className="text-left px-3 py-2.5 font-medium text-gray-700 text-xs whitespace-nowrap">Curso</th>
              <th className="text-left px-3 py-2.5 font-medium text-gray-700 text-xs whitespace-nowrap">Data</th>
              <th className="text-left px-3 py-2.5 font-medium text-gray-700 text-xs whitespace-nowrap">Status</th>
              <th className="text-left px-3 py-2.5 font-medium text-gray-700 text-xs whitespace-nowrap">Pont.</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {comunicacoes.map((c) => (
              <tr key={c.id} className="hover:bg-gray-50">
                <td className="px-3 py-2.5 font-mono text-xs text-gray-700 whitespace-nowrap">{c.protocolNumber}</td>
                <td className="px-3 py-2.5 text-xs text-gray-600 whitespace-nowrap">{c.type.name}</td>
                <td className="px-3 py-2.5 text-xs font-medium text-gray-900 whitespace-nowrap">{c.student.warName}</td>
                <td className="px-3 py-2.5 text-xs text-gray-500 whitespace-nowrap">{c.student.course.name}</td>
                <td className="px-3 py-2.5 text-xs text-gray-500 whitespace-nowrap">
                  {format(new Date(c.factDate), "dd/MM/yyyy", { locale: ptBR })}
                </td>
                <td className="px-3 py-2.5 text-xs whitespace-nowrap">{resolveStatusLabel(c)}</td>
                <td className="px-3 py-2.5 text-xs font-bold whitespace-nowrap">
                  {c.finalScore != null ? c.finalScore.toFixed(1) : "—"}
                </td>
              </tr>
            ))}
            {comunicacoes.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                  Nenhuma comunicação encontrada.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
