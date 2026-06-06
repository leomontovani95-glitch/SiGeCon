import { prisma } from "@/lib/db";
import { verifyRole } from "@/lib/dal";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import AdicionarItemBtn from "../../_components/AdicionarItemBtn";
import PublicarBtn from "../../_components/PublicarBtn";
import Link from "next/link";

export default async function EditarCadernoPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await verifyRole(
    "ADMINISTRADOR", "PROTOCOLO", "COMANDANTE_ESFAP", "COMANDANTE_ESFO", "CHEFE_DIVISAO_ACADEMICA",
    "SUBCOMANDANTE_ESFAP", "SUBCOMANDANTE_ESFO", "OFICIAL_ESFAP", "OFICIAL_ESFO",
  );
  const { id } = await params;

  const [caderno, decididas] = await Promise.all([
    prisma.disciplinaryBook.findUnique({
      where: { id },
      include: {
        createdBy: true,
        course: true,
        items: {
          orderBy: [{ studentWarName: "asc" }],
          include: {
            student: { include: { course: true, platoon: true } },
            communication: { select: { protocolNumber: true, article: true, item: true, letter: true } },
          },
        },
      },
    }),
    prisma.communication.findMany({
      where: { status: "DECIDIDA" },
      include: { student: { include: { course: true, platoon: true } }, type: true, decisions: true },
      orderBy: { updatedAt: "asc" },
    }),
  ]);

  if (!caderno) notFound();

  const itemIds = new Set(caderno.items.map((i) => i.communicationId));
  const disponiveis = decididas.filter((c) => !itemIds.has(c.id));
  const canPublish = caderno.status !== "PUBLICADO";
  const numero = caderno.course
    ? `CD Nº ${String(caderno.number).padStart(2, "0")} — ${caderno.course.name}`
    : `CD-${String(caderno.number).padStart(4, "0")}`;

  function fmtEnq(art: string | null, inc: string | null, al: string | null) {
    if (!art) return "—";
    let s = `Art. ${art}`;
    if (inc) s += `, ${inc}`;
    if (al) s += `, ${al})`;
    return s;
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{numero} — Revisão antes da publicação</h1>
          <p className="text-sm text-gray-500">Criado por {caderno.createdBy.warName}. Verifique os registros antes de publicar.</p>
        </div>
        <div className="flex gap-3">
          <Link href={`/caderno/${id}`} className="btn-secondary text-sm">Visualizar</Link>
          {canPublish && <PublicarBtn cadernoId={id} />}
        </div>
      </div>

      {/* Registros compilados — tabela com scroll */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-gray-900">
            Registros nesta edição
            <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">{caderno.items.length}</span>
          </h2>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <div className="overflow-y-auto max-h-[50vh]">
              <table className="w-full text-sm">
                <thead className="bg-[#1e3a5f] text-white sticky top-0 z-10">
                  <tr>
                    <th className="text-left px-3 py-3 font-medium whitespace-nowrap">Protocolo CPI</th>
                    <th className="text-left px-3 py-3 font-medium whitespace-nowrap">Enquadramento</th>
                    <th className="text-left px-3 py-3 font-medium whitespace-nowrap">Curso</th>
                    <th className="text-left px-3 py-3 font-medium whitespace-nowrap">Pelotão</th>
                    <th className="text-left px-3 py-3 font-medium whitespace-nowrap">Nº</th>
                    <th className="text-left px-3 py-3 font-medium whitespace-nowrap">Nome de Guerra</th>
                    <th className="text-left px-3 py-3 font-medium whitespace-nowrap">Tipo</th>
                    <th className="text-left px-3 py-3 font-medium whitespace-nowrap">Data Fato</th>
                    <th className="text-left px-3 py-3 font-medium whitespace-nowrap">Decisão</th>
                    <th className="text-right px-3 py-3 font-medium whitespace-nowrap">Pont.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {caderno.items.map((item, idx) => (
                    <tr key={item.id} className={idx % 2 === 0 ? "bg-white hover:bg-gray-50" : "bg-gray-50 hover:bg-gray-100"}>
                      <td className="px-3 py-2.5 font-mono text-xs">
                        <Link href={`/comunicacoes/${item.communicationId}`} className="text-blue-700 hover:underline hover:text-blue-900">
                          {item.communication.protocolNumber}
                        </Link>
                      </td>
                      <td className="px-3 py-2.5 text-xs text-gray-600 whitespace-nowrap">
                        {fmtEnq(item.communication.article, item.communication.item, item.communication.letter)}
                      </td>
                      <td className="px-3 py-2.5 text-xs">{item.student.course.name}</td>
                      <td className="px-3 py-2.5 text-xs text-gray-600">{item.student.platoon?.name ?? "—"}</td>
                      <td className="px-3 py-2.5 font-mono text-xs">{item.studentCourseNumber}</td>
                      <td className="px-3 py-2.5 font-semibold">{item.studentWarName}</td>
                      <td className="px-3 py-2.5 text-xs text-gray-700">{item.recordType}</td>
                      <td className="px-3 py-2.5 text-xs text-gray-500 whitespace-nowrap">
                        {format(new Date(item.factDate), "dd/MM/yyyy", { locale: ptBR })}
                      </td>
                      <td className="px-3 py-2.5 text-xs">{item.decisionSummary}</td>
                      <td className="px-3 py-2.5 text-right font-bold text-xs">
                        {item.score != null ? (
                          <span className={item.score > 0 ? "text-red-600" : item.score < 0 ? "text-green-600" : "text-gray-500"}>
                            {item.score > 0 ? "−" : item.score < 0 ? "+" : ""}{Math.abs(item.score).toFixed(1)}
                          </span>
                        ) : "—"}
                      </td>
                    </tr>
                  ))}
                  {caderno.items.length === 0 && (
                    <tr><td colSpan={10} className="px-4 py-6 text-center text-gray-400">Nenhum registro compilado.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
          <div className="px-4 py-2 bg-gray-50 border-t text-xs text-gray-500">{caderno.items.length} registro(s) compilado(s)</div>
        </div>
      </div>

      {/* Decisões não incluídas */}
      {disponiveis.length > 0 && (
        <div className="mb-6">
          <h2 className="font-semibold text-gray-900 mb-3">
            Decisões não incluídas
            <span className="ml-2 text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">{disponiveis.length}</span>
          </h2>
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <div className="overflow-y-auto max-h-[30vh]">
                <table className="w-full text-sm">
                  <thead className="bg-gray-100 border-b border-gray-200 sticky top-0 z-10">
                    <tr>
                      <th className="text-left px-3 py-2 font-medium text-gray-700 text-xs">Protocolo</th>
                      <th className="text-left px-3 py-2 font-medium text-gray-700 text-xs">Aluno</th>
                      <th className="text-left px-3 py-2 font-medium text-gray-700 text-xs">Tipo</th>
                      <th className="text-left px-3 py-2 font-medium text-gray-700 text-xs">Decisão</th>
                      <th className="px-3 py-2"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {disponiveis.map((c) => (
                      <tr key={c.id} className="hover:bg-gray-50">
                        <td className="px-3 py-2 font-mono text-xs text-gray-500">{c.protocolNumber}</td>
                        <td className="px-3 py-2 font-medium text-gray-900">{c.student.warName}</td>
                        <td className="px-3 py-2 text-xs text-gray-600">{c.type.name}</td>
                        <td className="px-3 py-2 text-xs text-gray-600">{c.decisions[0]?.decisionType ?? "—"}</td>
                        <td className="px-3 py-2">
                          <AdicionarItemBtn cadernoId={id} communicationId={c.id} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {canPublish && caderno.items.length > 0 && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-5">
          <h3 className="font-semibold text-green-900 mb-1">Pronto para publicação</h3>
          <p className="text-sm text-gray-600 mb-4">
            Após publicar, <strong>{caderno.items.length} comunicação(ões)</strong> terão status alterado para
            <em> Publicada em Caderno</em> e as pontuações passarão a contar na nota dos alunos.
          </p>
          <PublicarBtn cadernoId={id} />
        </div>
      )}
    </div>
  );
}
