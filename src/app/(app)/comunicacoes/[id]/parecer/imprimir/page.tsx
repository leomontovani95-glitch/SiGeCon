import { prisma } from "@/lib/db";
import { verifySession } from "@/lib/dal";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import PrintLayout from "@/components/PrintLayout";

export default async function ImprimirParecerPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await verifySession();
  const { id } = await params;

  const comm = await prisma.communication.findUnique({
    where: { id },
    include: {
      type: true,
      student: { include: { course: true, platoon: true } },
      defenses: true,
      opinions: { include: { author: true } },
    },
  });
  if (!comm) notFound();

  if (comm.opinions.length === 0) notFound();
  const opinion = comm.opinions[0];

  return (
    <PrintLayout title={`Parecer — ${comm.protocolNumber}`}>
      <div className="print-section">
        <h2>Parecer — {comm.type.name}</h2>
        <div className="print-grid">
          <div className="print-field"><label>Protocolo</label><span className="print-protocol">{comm.protocolNumber}</span></div>
          <div className="print-field"><label>Data</label><span>{format(new Date(opinion.createdAt), "dd/MM/yyyy", { locale: ptBR })}</span></div>
        </div>
      </div>

      <div className="print-section">
        <h2>Identificação do Comunicado</h2>
        <div className="print-grid">
          <div className="print-field"><label>Nome de guerra</label><span>{comm.student.warName}</span></div>
          <div className="print-field"><label>Curso / Nº</label><span>{comm.student.course.name} — {comm.courseNumber}</span></div>
          <div className="print-field"><label>Pelotão</label><span>{comm.student.platoon?.name ?? "—"}</span></div>
          <div className="print-field"><label>Data do fato</label><span>{format(new Date(comm.factDate), "dd/MM/yyyy", { locale: ptBR })}</span></div>
        </div>
      </div>

      {comm.defenses.length > 0 && (
        <div className="print-section">
          <h2>Análise da Defesa Apresentada</h2>
          <p style={{ fontSize: "9pt", color: "#555", marginBottom: 6, fontStyle: "italic" }}>O aluno apresentou justificativa/defesa em {format(new Date(comm.defenses[0].submittedAt), "dd/MM/yyyy", { locale: ptBR })}.</p>
        </div>
      )}

      <div className="print-section">
        <h2>Texto do Parecer</h2>
        <p className="print-text">{opinion.text}</p>
      </div>

      {opinion.recommendation && (
        <div className="print-section">
          <h2>Recomendação</h2>
          <p style={{ fontSize: "11pt", fontWeight: "bold" }}>{opinion.recommendation}</p>
        </div>
      )}

      <div className="print-signatures" style={{ marginTop: 48 }}>
        <div className="print-sig-line" style={{ gridColumn: "1 / -1", maxWidth: 320, margin: "0 auto" }}>
          <p>{opinion.author.rank} {opinion.author.warName}</p>
          <p>{opinion.authorRole === "SUBCOMANDANTE" ? "Subcomandante da Escola" : "Oficial da Escola"}</p>
        </div>
      </div>
    </PrintLayout>
  );
}
