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

  const [aluno, pubItems, provisItems] = await Promise.all([
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
    prisma.disciplinaryBookItem.findMany({
      where: { studentId: id, disciplinaryBook: { status: "RASCUNHO" } },
      include: { communication: { include: { type: { select: { scoreNature: true } } } } },
    }),
  ]);
  if (!aluno) notFound();

  const nota  = calcularNotaPublicada(pubItems);
  const faixa = faixaNota(nota);
  const risco = zonaDeRisco(nota);

  const notaProvisoria = provisItems.length > 0
    ? calcularNotaPublicada([...pubItems, ...provisItems])
    : nota;

  const totalDesfavoravel = pubItems
    .filter((i) => i.communication.type.scoreNature === "DESFAVORAVEL")
    .reduce((s, i) => s + Math.abs(i.score ?? 0), 0);
  const totalFavoravel = pubItems
    .filter((i) => i.communication.type.scoreNature === "FAVORAVEL")
    .reduce((s, i) => s + Math.abs(i.score ?? 0), 0);

  const ct = aluno.communications.reduce((acc, c) => { acc[c.type.name] = (acc[c.type.name] ?? 0) + 1; return acc; }, {} as Record<string, number>);
  const resumo = [
    { label: "Total",         value: aluno.communications.length,                              desfav: false, fav: false },
    { label: "Publicados",    value: pubItems.length,                                           desfav: false, fav: false },
    { label: "P. Adapt.",     value: aluno.communications.filter((c) => c.adaptationPeriod).length, desfav: false, fav: false },
    { label: "CPI 0/1",       value: (ct["CPI 0"] ?? 0) + (ct["CPI 1"] ?? 0),                desfav: true,  fav: false },
    { label: "CPI 2",         value: ct["CPI 2"] ?? 0,                                         desfav: true,  fav: false },
    { label: "CPI 3",         value: ct["CPI 3"] ?? 0,                                         desfav: true,  fav: false },
    { label: "TD Leve",       value: ct["TD Leve"] ?? 0,                                       desfav: true,  fav: false },
    { label: "TD Média",      value: ct["TD Média"] ?? 0,                                      desfav: true,  fav: false },
    { label: "TD Grave",      value: ct["TD Grave"] ?? 0,                                      desfav: true,  fav: false },
    { label: "TAC",           value: ct["TAC"] ?? 0,                                            desfav: true,  fav: false },
    { label: "Arq.",          value: ct["Arquivamento"] ?? 0,                                   desfav: false, fav: false },
    { label: "Ref. Elogiosa", value: ct["Referência Elogiosa"] ?? 0,                           desfav: false, fav: true  },
    { label: "Elogio BI",     value: ct["Elogio publicado em BI"] ?? 0,                        desfav: false, fav: true  },
  ];

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

      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Dados Cadastrais</h2>
        <dl className="grid grid-cols-1 sm:grid-cols-3 gap-x-6 gap-y-3">
          {[
            { label: "RG",           value: aluno.rg },
            { label: "Nº Funcional", value: aluno.functionalNumber },
            { label: "Situação",     value: aluno.status === "ATIVO" ? "Ativo" : aluno.status === "INATIVO" ? "Inativo" : aluno.status },
          ].map(({ label, value }) => (
            <div key={label}>
              <dt className="text-xs text-gray-500">{label}</dt>
              <dd className="mt-0.5 text-sm font-medium text-gray-900">{value ?? "—"}</dd>
            </div>
          ))}
        </dl>
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
          {provisItems.length > 0 && (
            <div className="mt-2 pt-2 border-t border-gray-200">
              <p className="text-xs text-gray-500">
                Nota provisória:{" "}
                <span className={`font-bold ${notaProvisoria < nota ? "text-red-600" : "text-gray-700"}`}>
                  {notaProvisoria.toFixed(2)}
                </span>
                <span className="text-gray-400"> (incl. rascunho)</span>
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-6">
        <div className="px-5 py-3 border-b border-gray-100">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Resumo de Registros</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {resumo.map(({ label }) => (
                  <th key={label} className="px-3 py-2 text-center text-xs font-medium text-gray-500 whitespace-nowrap">{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                {resumo.map(({ label, value, desfav, fav }) => (
                  <td key={label} className={`px-3 py-3 text-center text-base font-bold ${value > 0 && desfav ? "text-red-700" : value > 0 && fav ? "text-green-700" : value > 0 ? "text-gray-800" : "text-gray-300"}`}>
                    {value}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
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
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded">
                      {STATUS_MAP[c.status] ?? c.status}
                    </span>
                    {c.adaptationPeriod && (
                      <span className="text-xs px-1.5 py-0.5 rounded font-semibold bg-orange-100 text-orange-700">PA</span>
                    )}
                  </div>
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
