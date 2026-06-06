import { prisma } from "@/lib/db";
import { verifySession, getSchoolFilter } from "@/lib/dal";
import { redirect } from "next/navigation";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export default async function RelatoriosPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const session = await verifySession();
  if (session.role === "ALUNO") redirect("/acesso-negado");
  const sp = await searchParams;
  const tipo        = sp.tipo        ?? "";
  const status      = sp.status      ?? "";
  const dataInicio  = sp.dataInicio  ?? "";
  const dataFim     = sp.dataFim     ?? "";

  const school = getSchoolFilter(session.role, session.escola);

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

  const [comunicacoes, tipos] = await Promise.all([
    prisma.communication.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        type: true, student: { include: { course: true } }, reporter: true, decisions: true,
        disciplinaryBookItems: { include: { disciplinaryBook: { select: { status: true } } } },
      },
      take: 200,
    }),
    prisma.communicationType.findMany({ orderBy: { name: "asc" } }),
  ]);

  const total         = comunicacoes.length;
  const desfavoraveis = comunicacoes.filter((c) => c.type.scoreNature === "DESFAVORAVEL").length;
  const favoraveis    = comunicacoes.filter((c) => c.type.scoreNature === "FAVORAVEL").length;
  const decididas     = comunicacoes.filter((c) => c.status === "DECIDIDA").length;

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Relatórios</h1>
        <p className="text-sm text-gray-500">Para o ranking de conduta, acesse o menu <strong>Ranking de Conduta</strong>.</p>
      </div>

      {/* Filtros */}
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
      <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
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
    </div>
  );
}
