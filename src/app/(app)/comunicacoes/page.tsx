import { prisma } from "@/lib/db";
import { verifySession, getSchoolFilter } from "@/lib/dal";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import Link from "next/link";

const STATUS_LABELS: Record<string, string> = {
  REGISTRADA: "Registrada", AGUARDANDO_CIENCIA: "Ag. Ciência",
  AGUARDANDO_DEFESA: "Ag. Defesa", JUSTIFICATIVA_APRESENTADA: "Defesa Apresentada",
  PRAZO_EXPIRADO: "Prazo Expirado", AGUARDANDO_PARECER: "Ag. Parecer",
  PARECER_EMITIDO: "Parecer Emitido", AGUARDANDO_DECISAO: "Ag. Decisão",
  DECIDIDA: "Decidida", ARQUIVADA: "Arquivada", PUBLICADA_CADERNO: "Pub. Caderno",
  FINALIZADA: "Finalizada", DEVOLVIDA: "Devolvida",
};

const STATUS_COLORS: Record<string, string> = {
  REGISTRADA: "bg-blue-100 text-blue-700",
  AGUARDANDO_CIENCIA: "bg-yellow-100 text-yellow-700",
  AGUARDANDO_DEFESA: "bg-orange-100 text-orange-700",
  PRAZO_EXPIRADO: "bg-red-100 text-red-700",
  AGUARDANDO_PARECER: "bg-purple-100 text-purple-700",
  AGUARDANDO_DECISAO: "bg-indigo-100 text-indigo-700",
  DECIDIDA: "bg-green-100 text-green-700",
  ARQUIVADA: "bg-gray-100 text-gray-700",
  PUBLICADA_CADERNO: "bg-teal-100 text-teal-700",
  FINALIZADA: "bg-green-200 text-green-900",
};

export default async function ComunicacoesPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const session = await verifySession();
  const sp = await searchParams;
  const busca = sp.busca ?? "";
  const status = sp.status ?? "";

  const where: Record<string, unknown> = {};
  if (status) where.status = status;
  if (busca) {
    where.OR = [
      { protocolNumber: { contains: busca } },
      { student: { warName: { contains: busca } } },
      { student: { fullName: { contains: busca } } },
    ];
  }

  const school = getSchoolFilter(session.role, session.escola);
  if (school) where.course = { school };

  if (session.role === "ALUNO") {
    const aluno = await prisma.student.findFirst({ where: { email: session.email } });
    if (aluno) where.studentId = aluno.id;
  }

  const comunicacoes = await prisma.communication.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: { type: true, student: true, reporter: true },
    take: 100,
  });

  const canCreate = session.role !== "ALUNO";

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Comunicações</h1>
          <p className="text-sm text-gray-500">{comunicacoes.length} resultado(s)</p>
        </div>
        {canCreate && (
          <div className="flex gap-2 flex-wrap">
            <Link href="/comunicacoes/nova/cpi" className="bg-[#1e3a5f] text-white px-4 py-2 rounded-lg text-sm hover:bg-[#16304f] transition-colors">+ Nova CPI</Link>
            <Link href="/comunicacoes/nova/referencia" className="border border-[#1e3a5f] text-[#1e3a5f] px-4 py-2 rounded-lg text-sm hover:bg-blue-50 transition-colors">+ Ref. Elogiosa</Link>
            <Link href="/comunicacoes/nova/elogio-bi" className="border border-green-600 text-green-700 px-4 py-2 rounded-lg text-sm hover:bg-green-50 transition-colors">+ Elogio em BI</Link>
          </div>
        )}
      </div>

      <form method="GET" className="flex gap-3 mb-4 flex-wrap">
        <input name="busca" defaultValue={busca} placeholder="Protocolo, nome de guerra..." className="input max-w-xs" />
        <select name="status" defaultValue={status} className="input max-w-xs">
          <option value="">Todos os status</option>
          {Object.entries(STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <button type="submit" className="btn-primary px-6">Filtrar</button>
      </form>

      <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-700">Protocolo</th>
              <th className="text-left px-4 py-3 font-medium text-gray-700">Tipo</th>
              <th className="text-left px-4 py-3 font-medium text-gray-700">Aluno</th>
              <th className="text-left px-4 py-3 font-medium text-gray-700">Data do Fato</th>
              <th className="text-left px-4 py-3 font-medium text-gray-700">Status</th>
              <th className="text-left px-4 py-3 font-medium text-gray-700">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {comunicacoes.map((c) => (
              <tr key={c.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-mono text-xs text-gray-700">{c.protocolNumber}</td>
                <td className="px-4 py-3 text-gray-600">{c.type.name}</td>
                <td className="px-4 py-3 font-medium text-gray-900">{c.student.warName}</td>
                <td className="px-4 py-3 text-gray-500">{format(new Date(c.factDate), "dd/MM/yyyy", { locale: ptBR })}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${STATUS_COLORS[c.status] ?? "bg-gray-100 text-gray-700"}`}>
                    {STATUS_LABELS[c.status] ?? c.status}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <Link href={`/comunicacoes/${c.id}`} className="text-xs text-[#1e3a5f] hover:underline">Detalhes</Link>
                </td>
              </tr>
            ))}
            {comunicacoes.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">Nenhuma comunicação encontrada.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
