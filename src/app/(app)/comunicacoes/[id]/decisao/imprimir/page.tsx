import { prisma } from "@/lib/db";
import { verifySession } from "@/lib/dal";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import PrintLayout from "@/components/PrintLayout";
import { escolaHeaderLabel } from "@/lib/utils";

export default async function ImprimirDecisaoPage({ params }: { params: Promise<{ id: string }> }) {
  await verifySession();
  const { id } = await params;

  const comm = await prisma.communication.findUnique({
    where: { id },
    include: {
      type: true,
      student: { include: { course: true, platoon: true } },
      opinions: { include: { author: true } },
      decisions: { include: { authority: true } },
    },
  });
  if (!comm) notFound();
  if (comm.decisions.length === 0) notFound();

  const decision = comm.decisions[0];

  return (
    <PrintLayout title={`Decisão — ${comm.protocolNumber}`} escola={escolaHeaderLabel(comm.student.course.school)}>
      <div className="print-section">
        <h2>Decisão do Comandante da Escola</h2>
        <div className="print-grid">
          <div className="print-field"><label>Protocolo</label><span className="print-protocol">{comm.protocolNumber}</span></div>
          <div className="print-field"><label>Tipo</label><span>{comm.type.name}</span></div>
          <div className="print-field"><label>Data da decisão</label><span>{format(new Date(decision.decidedAt), "dd/MM/yyyy", { locale: ptBR })}</span></div>
        </div>
      </div>

      <div className="print-section">
        <h2>Identificação do Comunicado</h2>
        <div className="print-grid">
          <div className="print-field"><label>Nome completo</label><span>{comm.student.fullName}</span></div>
          <div className="print-field"><label>Nome de guerra</label><span>{comm.student.warName}</span></div>
          <div className="print-field"><label>Curso / Nº</label><span>{comm.student.course.name} — {comm.courseNumber}</span></div>
          <div className="print-field"><label>Pelotão</label><span>{comm.student.platoon?.name ?? "—"}</span></div>
          <div className="print-field"><label>Data do fato</label><span>{format(new Date(comm.factDate), "dd/MM/yyyy", { locale: ptBR })}</span></div>
        </div>
      </div>

      {comm.opinions.length > 0 && (
        <div className="print-section">
          <h2>Síntese do Parecer</h2>
          <p style={{ fontSize: "9pt", color: "#555" }}>
            {comm.opinions[0].author.fullName} recomendou: <strong>{comm.opinions[0].recommendation ?? "sem recomendação específica"}</strong>.
          </p>
        </div>
      )}

      <div className="print-section">
        <h2>Decisão — {decision.decisionType}</h2>
        <p className="print-text">{decision.text}</p>
      </div>

      {decision.finalScore != null && (
        <div className="print-section">
          <h2>Pontuação Final Aplicada</h2>
          <p style={{ fontSize: "13pt", fontWeight: "bold" }}>
            {comm.type.scoreNature === "DESFAVORAVEL" ? "−" : "+"}{decision.finalScore.toFixed(1)} ponto(s)
          </p>
        </div>
      )}

      <div className="print-signatures" style={{ marginTop: 48 }}>
        <div className="print-sig-line" style={{ gridColumn: "1 / -1", maxWidth: 360, margin: "0 auto" }}>
          <p>{decision.authority.rank} {decision.authority.fullName}</p>
          <p>Comandante da Escola</p>
          <p style={{ fontSize: "8pt", color: "#666" }}>{format(new Date(decision.decidedAt), "dd/MM/yyyy", { locale: ptBR })}</p>
        </div>
      </div>
    </PrintLayout>
  );
}
