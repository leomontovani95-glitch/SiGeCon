import { prisma } from "@/lib/db";
import { verifySession } from "@/lib/dal";
import { calcularNotaPublicada, faixaNota, zonaDeRisco } from "@/lib/score";
import { notFound } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const STATUS_MAP: Record<string, string> = {
  REGISTRADA: "Registrada",
  AGUARDANDO_CIENCIA: "Ag. Ciência/Defesa",
  AGUARDANDO_DEFESA: "Ag. Ciência/Defesa",
  PRAZO_EXPIRADO: "Prazo Expirado",
  AGUARDANDO_PARECER: "Ag. Parecer", AGUARDANDO_DECISAO: "Ag. Decisão",
  DECIDIDA: "Decidida", ARQUIVADA: "Arquivada",
  PUBLICADA_CADERNO: "Publicada em Caderno", FINALIZADA: "Finalizada",
};

export default async function AlunoPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await verifySession();
  const { id } = await params;

  if (session.role === "ALUNO") {
    const aluno = await prisma.student.findFirst({ where: { id, userId: session.userId } });
    if (!aluno) notFound();
  }

  const [aluno, pubItems] = await Promise.all([
    prisma.student.findUnique({
      where: { id },
      include: {
        course: true,
        platoon: true,
        communications: {
          include: { type: true, decisions: { include: { authority: true } } },
          orderBy: { createdAt: "desc" },
        },
      },
    }),
    prisma.disciplinaryBookItem.findMany({
      where: { studentId: id, disciplinaryBook: { status: "PUBLICADO" } },
      include: { communication: { include: { type: { select: { scoreNature: true } } } } },
    }),
  ]);
  if (!aluno) notFound();

  const nota  = calcularNotaPublicada(pubItems);
  const faixa = faixaNota(nota);
  const risco = zonaDeRisco(nota);

  const totalDesfavoravel = pubItems
    .filter((i) => i.communication.type.scoreNature === "DESFAVORAVEL")
    .reduce((s, i) => s + Math.abs(i.score ?? 0), 0);
  const totalFavoravel = pubItems
    .filter((i) => i.communication.type.scoreNature === "FAVORAVEL")
    .reduce((s, i) => s + Math.abs(i.score ?? 0), 0);

  return (
    <div className="p-6 max-w-4xl">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{aluno.warName}</h1>
          <p className="text-sm text-gray-500">{aluno.fullName}</p>
        </div>
        <div className="flex gap-2 flex-wrap justify-end">
          <Link href={`/alunos/${aluno.id}/historico`} target="_blank" className="btn-secondary text-xs">
            Gerar PDF do Histórico
          </Link>
          {session.role !== "ALUNO" && (
            <Link href={`/alunos/${aluno.id}/editar`} className="btn-secondary text-xs">Editar</Link>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 mb-1">Curso / Nº</p>
          <p className="font-semibold text-gray-900">{aluno.course.name}</p>
          <p className="text-sm text-gray-600">Nº {aluno.courseNumber}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 mb-1">Pelotão</p>
          <p className="font-semibold text-gray-900">{aluno.platoon?.name ?? "—"}</p>
        </div>
        <div className={`rounded-xl border p-4 ${risco ? "border-red-300 bg-red-50" : "border-gray-200 bg-white"}`}>
          <p className="text-xs text-gray-500 mb-1">Nota — Conduta Profissional</p>
          <div className="flex items-center gap-2">
            <span className={`text-2xl font-bold px-3 py-1 rounded-lg ${faixa.tailwind}`}>
              {nota.toFixed(2)}
            </span>
            {risco && <span className="text-xs text-red-700 font-medium">⚠ Zona de Risco</span>}
          </div>
          <div className="flex gap-4 mt-2 text-xs text-gray-500">
            <span className="text-red-600">− {totalDesfavoravel.toFixed(1)} desfav.</span>
            <span className="text-green-600">+ {totalFavoravel.toFixed(1)} fav.</span>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Histórico de Comunicações</h2>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-700">Protocolo</th>
              <th className="text-left px-4 py-3 font-medium text-gray-700">Tipo</th>
              <th className="text-left px-4 py-3 font-medium text-gray-700">Data</th>
              <th className="text-left px-4 py-3 font-medium text-gray-700">Status</th>
              <th className="text-left px-4 py-3 font-medium text-gray-700">Pontuação</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {aluno.communications.map((c) => (
              <tr key={c.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <Link href={`/comunicacoes/${c.id}`} className="font-mono text-xs text-[#1e3a5f] hover:underline">
                    {c.protocolNumber}
                  </Link>
                </td>
                <td className="px-4 py-3 text-gray-600">{c.type.name}</td>
                <td className="px-4 py-3 text-gray-500">
                  {format(new Date(c.factDate), "dd/MM/yyyy", { locale: ptBR })}
                </td>
                <td className="px-4 py-3">
                  <span className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded">
                    {STATUS_MAP[c.status] ?? c.status}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {c.finalScore != null ? (
                    <span className={c.type.scoreNature === "DESFAVORAVEL" ? "text-red-600 font-medium" : "text-green-600 font-medium"}>
                      {c.type.scoreNature === "DESFAVORAVEL" ? "−" : "+"}{c.finalScore.toFixed(1)}
                    </span>
                  ) : "—"}
                </td>
              </tr>
            ))}
            {aluno.communications.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-400">Nenhuma comunicação registrada.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
