import { prisma } from "@/lib/db";
import { verifySession } from "@/lib/dal";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import PrintLayout from "@/components/PrintLayout";

export default async function ImprimirComunicacaoPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await verifySession();
  const { id } = await params;

  const comm = await prisma.communication.findUnique({
    where: { id },
    include: {
      type: true,
      student: { include: { course: true, platoon: true } },
      reporter: true,
      manualRule: true,
      witnesses: true,
      acknowledgements: true,
      defenses: true,
      opinions: { include: { author: true } },
      decisions: { include: { authority: true } },
    },
  });
  if (!comm) notFound();

  if (session.role === "ALUNO" && comm.student.userId !== session.userId) notFound();

  const isCPI = comm.type.name.startsWith("CPI");
  const docTitle = isCPI ? `CPI — ${comm.protocolNumber}` : `Referência Elogiosa — ${comm.protocolNumber}`;

  return (
    <PrintLayout title={docTitle}>
      <div className="print-section">
        <h2>{isCPI ? "Conduta Profissional Inadequada (CPI)" : "Referência Elogiosa"}</h2>
        <div className="print-field">
          <label>Número de Protocolo</label>
          <span className="print-protocol">{comm.protocolNumber}</span>
        </div>
        <div className="print-field">
          <label>Tipo</label>
          <span>{comm.type.name} — Pontuação: {comm.type.score.toFixed(1)} ponto(s)</span>
        </div>
      </div>

      <div className="print-section">
        <h2>Dados do Comunicado / Aluno</h2>
        <div className="print-grid">
          <div className="print-field"><label>Nome completo</label><span>{comm.student.fullName}</span></div>
          <div className="print-field"><label>Nome de guerra</label><span>{comm.student.warName}</span></div>
          <div className="print-field"><label>Curso</label><span>{comm.student.course.name}</span></div>
          <div className="print-field"><label>Nº de curso</label><span>{comm.courseNumber}</span></div>
          <div className="print-field"><label>Pelotão</label><span>{comm.student.platoon?.name ?? "—"}</span></div>
          <div className="print-field"><label>RG</label><span>{comm.student.rg}</span></div>
        </div>
      </div>

      <div className="print-section">
        <h2>Dados do Fato</h2>
        <div className="print-grid">
          <div className="print-field"><label>Data do fato</label><span>{format(new Date(comm.factDate), "dd/MM/yyyy", { locale: ptBR })}</span></div>
          <div className="print-field"><label>Hora do fato</label><span>{comm.factTime ?? "—"}</span></div>
          <div className="print-field"><label>Local</label><span>{comm.factPlace ?? "—"}</span></div>
          {comm.article && (
            <div className="print-field">
              <label>Dispositivo legal</label>
              <span>Art. {comm.article}{comm.item ? `, Inc. ${comm.item}` : ""}{comm.letter ? `, Al. ${comm.letter}` : ""}</span>
            </div>
          )}
        </div>
      </div>

      <div className="print-section">
        <h2>Descrição do Fato</h2>
        <p className="print-text">{comm.factDescription}</p>
      </div>

      {comm.witnesses.length > 0 && (
        <div className="print-section">
          <h2>Testemunha(s)</h2>
          {comm.witnesses.map((w, i) => (
            <div key={w.id} className="print-field">
              <label>Testemunha {i + 1}</label>
              <span>{w.name}{w.rg ? ` — RG: ${w.rg}` : ""}{w.functionalNumber ? ` — Func: ${w.functionalNumber}` : ""}</span>
            </div>
          ))}
        </div>
      )}

      {comm.defenses.length > 0 && (
        <div className="print-section">
          <h2>Justificativa / Defesa do Aluno</h2>
          {comm.defenses.map((d) => (
            <div key={d.id}>
              <p className="print-text">{d.text}</p>
              <p style={{ fontSize: "8pt", color: "#888", marginTop: 4 }}>
                Apresentada em {format(new Date(d.submittedAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                {d.isLate ? " (FORA DO PRAZO)" : ""}
              </p>
            </div>
          ))}
        </div>
      )}

      {comm.opinions.length > 0 && (
        <div className="print-section">
          <h2>Parecer</h2>
          {comm.opinions.map((o) => (
            <div key={o.id}>
              <p className="print-text">{o.text}</p>
              {o.recommendation && <p style={{ fontWeight: "bold", marginTop: 4, fontSize: "10pt" }}>Recomendação: {o.recommendation}</p>}
              <p style={{ fontSize: "8pt", color: "#888" }}>{o.author.fullName} — {o.authorRole.replace(/_/g, " ")} — {format(new Date(o.createdAt), "dd/MM/yyyy", { locale: ptBR })}</p>
            </div>
          ))}
        </div>
      )}

      {comm.decisions.length > 0 && (
        <div className="print-section">
          <h2>Decisão do Comandante da Escola</h2>
          {comm.decisions.map((d) => (
            <div key={d.id}>
              <p style={{ fontWeight: "bold", fontSize: "11pt", marginBottom: 4 }}>{d.decisionType}</p>
              <p className="print-text">{d.text}</p>
              {d.finalScore != null && (
                <p style={{ fontWeight: "bold", marginTop: 6 }}>Pontuação aplicada: {d.finalScore.toFixed(1)} ponto(s)</p>
              )}
              <p style={{ fontSize: "8pt", color: "#888", marginTop: 4 }}>{d.authority.fullName} — {d.authority.role.replace(/_/g, " ")} — {format(new Date(d.decidedAt), "dd/MM/yyyy", { locale: ptBR })}</p>
            </div>
          ))}
        </div>
      )}

      <div className="print-section">
        <h2>Comunicante</h2>
        <div className="print-grid">
          <div className="print-field"><label>Comunicante</label><span>{comm.communicantName ?? "—"}</span></div>
          <div className="print-field"><label>Registrado por</label><span>{comm.reporter.rank} {comm.reporter.warName}</span></div>
          <div className="print-field"><label>Data do registro</label><span>{format(new Date(comm.createdAt), "dd/MM/yyyy", { locale: ptBR })}</span></div>
        </div>
      </div>

    </PrintLayout>
  );
}
