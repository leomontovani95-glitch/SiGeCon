import { prisma } from "@/lib/db";
import { verifySession, canEmitOpinion, canDecide } from "@/lib/dal";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import AcoesComm from "../_components/AcoesComm";
import ParecerForm from "../_components/ParecerForm";
import Link from "next/link";

const STATUS_LABELS: Record<string, string> = {
  REGISTRADA: "Registrada",
  AGUARDANDO_CIENCIA: "Aguardando Ciência/Defesa do Aluno",
  AGUARDANDO_DEFESA: "Aguardando Ciência/Defesa do Aluno",
  JUSTIFICATIVA_APRESENTADA: "Justificativa/Defesa Apresentada",
  PRAZO_EXPIRADO: "Prazo Expirado", AGUARDANDO_PARECER: "Aguardando Parecer",
  PARECER_EMITIDO: "Parecer Emitido", AGUARDANDO_DECISAO: "Aguardando Decisão do Comandante",
  DECIDIDA: "Decidida", ARQUIVADA: "Arquivada", PUBLICADA_CADERNO: "Publicada em Caderno",
  FINALIZADA: "Finalizada", DEVOLVIDA: "Devolvida para Complementação",
};

export default async function ComunicacaoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string>>;
}) {
  const session = await verifySession();
  const { id } = await params;
  const sp = await searchParams;
  const mostraFormDefesa = sp.defesa === "1";

  const [manualRules, comm] = await Promise.all([
    prisma.manualRule.findMany({ where: { active: true }, orderBy: [{ article: "asc" }, { item: "asc" }] }),
    prisma.communication.findUnique({
      where: { id },
      include: {
        type: true, student: { include: { course: true, platoon: true } },
        reporter: true, manualRule: true,
        witnesses: true, attachments: true,
        acknowledgements: true,
        defenses: { include: { attachments: true } },
        opinions: { include: { author: true } },
        decisions: { include: { authority: true } },
      },
    }),
  ]);
  if (!comm) notFound();

  if (session.role === "ALUNO") {
    const ehEsteAluno = comm.student.userId === session.userId;
    if (!ehEsteAluno) notFound();
  }

  const cadernoPublicado = comm.status === "PUBLICADA_CADERNO"
    ? await prisma.disciplinaryBook.findFirst({
        where: { status: "PUBLICADO", items: { some: { communicationId: comm.id } } },
        include: { course: true },
      })
    : null;

  const alunoEhEssePerfil = session.role === "ALUNO" && comm.student.userId === session.userId;

  const tomouCienciaComDefesa = comm.defenses.length > 0;
  const tomouCienciaSemDefesa = comm.acknowledgements.some((a) => a.method === "SEM_DEFESA");
  const mostrarSecaoDefesa = tomouCienciaComDefesa || tomouCienciaSemDefesa;

  return (
    <div className="p-6 max-w-4xl">
      <div className="flex items-start justify-between mb-6">
        <div>
          <p className="font-mono text-sm text-gray-500">{comm.protocolNumber}</p>
          <h1 className="text-2xl font-bold text-gray-900">{comm.type.name}</h1>
          <div className="flex flex-wrap gap-2 mt-1 items-center">
            <span className="inline-block text-xs px-3 py-1 rounded-full bg-blue-100 text-blue-700 font-medium">
              {STATUS_LABELS[comm.status] ?? comm.status}
            </span>
            {cadernoPublicado && (
              <span className="inline-block text-xs px-3 py-1 rounded-full bg-teal-100 text-teal-700 font-medium font-mono">
                {cadernoPublicado.course
                  ? `CD Nº ${String(cadernoPublicado.number).padStart(2, "0")} — ${cadernoPublicado.course.name}`
                  : `CD-${String(cadernoPublicado.number).padStart(4, "0")}`}
              </span>
            )}
          </div>
        </div>
        <div className="flex gap-2 flex-wrap justify-end">
          <Link href={`/comunicacoes/${comm.id}/imprimir`} target="_blank" className="btn-secondary text-xs">
            Gerar PDF
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-2">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Aluno / Comunicado</h2>
          <p className="font-semibold text-gray-900">{comm.student.warName}</p>
          <p className="text-sm text-gray-600">{comm.student.fullName}</p>
          <p className="text-sm text-gray-500">{comm.student.course.name} — Nº {comm.courseNumber}</p>
          {comm.student.platoon && <p className="text-sm text-gray-500">{comm.student.platoon.name}</p>}
          <p className="text-sm text-gray-500">RG: {comm.student.rg}</p>
          {comm.student.functionalNumber && (
            <p className="text-sm text-gray-500">NF: {comm.student.functionalNumber}</p>
          )}
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-2">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Dados do Fato</h2>
          <p className="text-sm text-gray-700"><span className="font-medium">Data:</span> {format(new Date(comm.factDate), "dd/MM/yyyy", { locale: ptBR })}</p>
          {comm.factTime && <p className="text-sm text-gray-700"><span className="font-medium">Hora:</span> {comm.factTime}</p>}
          {comm.factPlace && <p className="text-sm text-gray-700"><span className="font-medium">Local:</span> {comm.factPlace}</p>}
          <p className="text-sm text-gray-700"><span className="font-medium">Comunicante:</span> {comm.communicantName ?? comm.reporter.warName}</p>
          {comm.defenseDeadline && (
            <p className="text-sm text-gray-700">
              <span className="font-medium">Prazo ciência/defesa:</span>{" "}
              <span className={new Date() > new Date(comm.defenseDeadline) && comm.status === "AGUARDANDO_CIENCIA" ? "text-red-600 font-semibold" : "text-gray-700"}>
                {format(new Date(comm.defenseDeadline), "dd/MM/yyyy", { locale: ptBR })}
                {new Date() > new Date(comm.defenseDeadline) && comm.status === "AGUARDANDO_CIENCIA" && " ⚠ Expirado"}
              </span>
            </p>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Descrição do Fato</h2>
        <p className="text-sm text-gray-700 whitespace-pre-wrap">{comm.factDescription}</p>
      </div>

      {(comm.bgpmNumber || comm.tacEquivalent) && (
        <div className="bg-orange-50 rounded-xl border border-orange-200 p-4 mb-4">
          <h2 className="text-xs font-semibold text-orange-700 uppercase tracking-wide mb-2">Publicação em BGPM</h2>
          {comm.bgpmNumber && comm.bgpmYear && (
            <p className="text-sm text-gray-700">
              <span className="font-medium">BGPM:</span> Nº {comm.bgpmNumber}/{comm.bgpmYear}
            </p>
          )}
          {comm.tacEquivalent && (
            <p className="text-sm text-gray-700 mt-1">
              <span className="font-medium">TAC — Transgressão equivalente:</span> {comm.tacEquivalent}
            </p>
          )}
          {comm.finalScore != null && (
            <p className="text-sm text-gray-700 mt-1">
              <span className="font-medium">Desconto aplicado:</span> {comm.finalScore.toFixed(1)} ponto(s)
            </p>
          )}
        </div>
      )}

      {/* ── Timeline de tramitação ─────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Histórico de Tramitação</h2>
        <ol className="relative border-l border-gray-200 ml-3 space-y-3">
          {[
            {
              label: "Registrada",
              date: comm.createdAt,
              done: true,
              color: "bg-blue-500",
            },
            ...(comm.defenseDeadline || comm.acknowledgements.length > 0 || comm.defenses.length > 0 ? [{
              label: comm.defenseDeadline
                ? `Enviada para Ciência/Defesa — Prazo: ${format(new Date(comm.defenseDeadline), "dd/MM/yyyy", { locale: ptBR })}`
                : "Enviada para Ciência/Defesa do Aluno",
              date: null as Date | null,
              done: comm.acknowledgements.length > 0 || comm.defenses.length > 0 || !["REGISTRADA", "AGUARDANDO_CIENCIA", "AGUARDANDO_DEFESA"].includes(comm.status),
              color: "bg-yellow-500",
            }] : []),
            ...(comm.acknowledgements.length > 0 || comm.defenses.length > 0 ? [{
              label: comm.defenses.length > 0 ? "Defesa Apresentada pelo Aluno" : "Ciência Registrada (sem defesa)",
              date: comm.defenses[0]?.submittedAt ?? comm.acknowledgements[0]?.acknowledgedAt ?? null,
              done: true,
              color: "bg-amber-500",
            }] : []),
            ...(comm.opinions.length > 0 ? [{
              label: "Parecer Emitido",
              date: comm.opinions[0].createdAt,
              done: true,
              color: "bg-purple-500",
            }] : []),
            ...(comm.decisions.length > 0 ? [{
              label: comm.decisions[0].decisionType,
              date: comm.decisions[0].decidedAt,
              done: true,
              color: "bg-green-500",
            }] : []),
            ...(cadernoPublicado ? [{
              label: "Publicada em Caderno Disciplinar",
              date: cadernoPublicado.publicationDate,
              done: true,
              color: "bg-teal-500",
            }] : []),
          ].map((step, idx) => (
            <li key={idx} className="ml-4">
              <span className={`absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full border-2 border-white ${step.done ? step.color : "bg-gray-200"}`} />
              <p className={`text-sm font-medium ${step.done ? "text-gray-900" : "text-gray-400"}`}>{step.label}</p>
              {step.date && (
                <p className="text-xs text-gray-400">
                  {format(new Date(step.date), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                </p>
              )}
            </li>
          ))}
        </ol>
      </div>

      {comm.article && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Dispositivo Legal</h2>
          <p className="text-sm font-mono text-gray-700">
            Art. {comm.article}{comm.item ? ` — Inc. ${comm.item}` : ""}{comm.letter ? ` — Al. ${comm.letter}` : ""}
          </p>
          {comm.manualRule && <p className="text-sm text-gray-600 mt-1">{comm.manualRule.description}</p>}
        </div>
      )}

      {comm.acknowledgements.some((a) => a.method === "PRAZO_EXPIRADO") && (
        <div className="bg-red-50 rounded-xl border border-red-300 p-4 mb-4">
          <h2 className="text-xs font-semibold text-red-700 uppercase tracking-wide mb-1">
            ⚠ Encaminhamento Automático por Prazo Expirado
          </h2>
          {comm.acknowledgements.filter((a) => a.method === "PRAZO_EXPIRADO").map((a) => (
            <div key={a.id}>
              <p className="text-sm text-red-800">{a.notes}</p>
              <p className="text-xs text-red-400 mt-1">
                Processado automaticamente em {format(new Date(a.acknowledgedAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Posição do aluno — visível para todos após a ciência */}
      {mostrarSecaoDefesa && (
        <div className="bg-amber-50 rounded-xl border border-amber-200 p-4 mb-4">
          <h2 className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-2">Posição do Aluno</h2>
          {tomouCienciaComDefesa ? (
            comm.defenses.map((d) => (
              <div key={d.id}>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{d.text}</p>
                <p className="text-xs text-gray-400 mt-2">
                  Defesa apresentada em {format(new Date(d.submittedAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  {d.isLate && <span className="ml-2 text-red-600 font-medium">(Fora do prazo)</span>}
                </p>
                {d.attachments.length > 0 && (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span className="text-xs text-gray-500">Anexo(s):</span>
                    {d.attachments.map((a) => (
                      <a
                        key={a.id}
                        href={a.filePath}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-[#1e3a5f] bg-white border border-[#1e3a5f] rounded-lg px-3 py-1.5 hover:bg-blue-50 transition-colors"
                      >
                        📎 {a.fileName}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            ))
          ) : (
            <p className="text-sm text-gray-600 italic">
              O aluno tomou ciência da comunicação e optou por não apresentar justificativa/defesa.
            </p>
          )}
        </div>
      )}

      {comm.opinions.length > 0 && (
        <div className="bg-purple-50 rounded-xl border border-purple-200 p-4 mb-4">
          <h2 className="text-xs font-semibold text-purple-700 uppercase tracking-wide mb-2">Parecer</h2>
          {comm.opinions.map((o) => (
            <div key={o.id}>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{o.text}</p>
              {o.recommendation && <p className="text-sm font-medium text-purple-800 mt-2">Recomendação: {o.recommendation}</p>}
              <p className="text-xs text-gray-400 mt-2">
                {o.author.fullName} — {o.authorRole.replace(/_/g, " ")} — {format(new Date(o.createdAt), "dd/MM/yyyy", { locale: ptBR })}
              </p>
            </div>
          ))}
        </div>
      )}

      {comm.decisions.length > 0 && (
        <div className="bg-green-50 rounded-xl border border-green-200 p-4 mb-4">
          <h2 className="text-xs font-semibold text-green-700 uppercase tracking-wide mb-2">Decisão do Comandante</h2>
          {comm.decisions.map((d) => (
            <div key={d.id}>
              <p className="text-sm font-medium text-gray-900">{d.decisionType}</p>
              <p className="text-sm text-gray-700 whitespace-pre-wrap mt-1">{d.text}</p>
              {d.finalScore != null && (
                <p className="text-sm font-bold text-green-800 mt-2">Pontuação aplicada: {d.finalScore.toFixed(1)} pt</p>
              )}
              <p className="text-xs text-gray-400 mt-2">
                {d.authority.fullName} — {d.authority.role.replace(/_/g, " ")} — {format(new Date(d.decidedAt), "dd/MM/yyyy", { locale: ptBR })}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Formulário de parecer — componente independente para hidratação isolada */}
      {canEmitOpinion(session.role, session.additionalRoles) &&
        comm.status === "AGUARDANDO_PARECER" &&
        comm.opinions.length === 0 && (
          <ParecerForm
            communicationId={comm.id}
            manualRules={manualRules.map((r) => ({
              id: r.id,
              article: r.article,
              item: r.item ?? null,
              letter: r.letter ?? null,
              description: r.description,
            }))}
          />
        )}

      <AcoesComm
        comm={{
          id: comm.id,
          status: comm.status,
          defenseDeadline: comm.defenseDeadline?.toISOString() ?? null,
          studentId: comm.studentId,
          finalScore: comm.finalScore,
          suggestedScore: comm.suggestedScore,
          opinions: comm.opinions.map((o) => ({ id: o.id })),
          decisions: comm.decisions.map((d) => ({ id: d.id, finalScore: d.finalScore, decisionType: d.decisionType })),
          typeName: comm.type.name,
          item: comm.item,
        }}
        session={{ role: session.role, userId: session.userId, email: session.email }}
        alunoEhEssePerfil={alunoEhEssePerfil}
        mostraFormDefesa={mostraFormDefesa}
        manualRules={manualRules.map((r) => ({
          id: r.id,
          article: r.article,
          item: r.item ?? null,
          letter: r.letter ?? null,
          description: r.description,
        }))}
      />
    </div>
  );
}
