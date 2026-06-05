import { prisma } from "@/lib/db";
import { verifySession, getSchoolFilter, COMANDANTES, PARECERISTAS, VIEWERS_APM } from "@/lib/dal";
import { redirect } from "next/navigation";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import Link from "next/link";

const STATUS_LABELS: Record<string, string> = {
  AGUARDANDO_PARECER: "Ag. Parecer",
  JUSTIFICATIVA_APRESENTADA: "Defesa Apresentada",
  AGUARDANDO_DECISAO: "Ag. Decisão",
};

const STATUS_COLORS: Record<string, string> = {
  AGUARDANDO_PARECER: "bg-purple-100 text-purple-700",
  JUSTIFICATIVA_APRESENTADA: "bg-orange-100 text-orange-700",
  AGUARDANDO_DECISAO: "bg-indigo-100 text-indigo-700",
};

const DECISORES = COMANDANTES as string[];

export default async function DespachoPage() {
  const session = await verifySession();
  const { role } = session;

  const isParecerista = (PARECERISTAS as string[]).includes(role);
  const isDecisor = DECISORES.includes(role);
  const isViewer = (VIEWERS_APM as string[]).includes(role);

  if (!isParecerista && !isDecisor && !isViewer) redirect("/acesso-negado");

  const school = getSchoolFilter(role, session.escola);
  const schoolFilter = school ? { course: { school } } : {};

  const comunicacoes = await prisma.communication.findMany({
    where: isViewer
      ? { status: { in: ["AGUARDANDO_PARECER", "JUSTIFICATIVA_APRESENTADA", "AGUARDANDO_DECISAO"] } }
      : isParecerista
      ? { status: { in: ["AGUARDANDO_PARECER", "JUSTIFICATIVA_APRESENTADA"] }, ...schoolFilter }
      : { status: "AGUARDANDO_DECISAO", ...schoolFilter },
    orderBy: { updatedAt: "asc" },
    include: {
      type: true,
      student: { include: { course: true } },
      defenses: { select: { id: true } },
      opinions: { select: { id: true } },
    },
  });

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Despachos</h1>
        <p className="text-sm text-gray-500">
          {isViewer
            ? "Visão geral — comunicações pendentes de parecer ou decisão"
            : isParecerista
            ? "Comunicações aguardando emissão de parecer"
            : "Comunicações aguardando decisão final"}
        </p>
      </div>

      {comunicacoes.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-10 text-center text-gray-400">
          Nenhum despacho pendente no momento.
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-700">Protocolo</th>
                <th className="text-left px-4 py-3 font-medium text-gray-700">Tipo</th>
                <th className="text-left px-4 py-3 font-medium text-gray-700">Aluno</th>
                <th className="text-left px-4 py-3 font-medium text-gray-700">Curso</th>
                <th className="text-left px-4 py-3 font-medium text-gray-700">Data do Fato</th>
                <th className="text-left px-4 py-3 font-medium text-gray-700">Status</th>
                {!isParecerista && (
                  <th className="text-left px-4 py-3 font-medium text-gray-700">Parecer</th>
                )}
                <th className="text-left px-4 py-3 font-medium text-gray-700">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {comunicacoes.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs text-gray-700">{c.protocolNumber}</td>
                  <td className="px-4 py-3 text-gray-600">{c.type.name}</td>
                  <td className="px-4 py-3 font-medium text-gray-900">{c.student.warName}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">{c.student.course.name}</td>
                  <td className="px-4 py-3 text-gray-500">
                    {format(new Date(c.factDate), "dd/MM/yyyy", { locale: ptBR })}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${STATUS_COLORS[c.status] ?? "bg-gray-100 text-gray-700"}`}>
                      {STATUS_LABELS[c.status] ?? c.status}
                    </span>
                  </td>
                  {!isParecerista && (
                    <td className="px-4 py-3">
                      {c.opinions.length > 0 ? (
                        <span className="text-xs px-2 py-0.5 rounded bg-green-100 text-green-700 font-medium">Com parecer</span>
                      ) : c.defenses.length > 0 ? (
                        <span className="text-xs px-2 py-0.5 rounded bg-orange-100 text-orange-700 font-medium">Sem defesa/Sem parecer</span>
                      ) : (
                        <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-500">Sem defesa</span>
                      )}
                    </td>
                  )}
                  <td className="px-4 py-3">
                    <Link
                      href={`/comunicacoes/${c.id}`}
                      className="text-xs font-medium text-[#1e3a5f] hover:underline"
                    >
                      {isViewer ? "Ver →" : isParecerista ? "Emitir Parecer →" : "Proferir Decisão →"}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
