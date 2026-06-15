import { prisma } from "@/lib/db";
import { verifySession } from "@/lib/dal";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import PrintLayout from "@/components/PrintLayout";
import { calcularPrazoDefesa } from "@/lib/prazos";

export default async function TermoCienciaPage({ params }: { params: Promise<{ id: string }> }) {
  await verifySession();
  const { id } = await params;

  const comm = await prisma.communication.findUnique({
    where: { id },
    include: {
      type: true,
      student: { include: { course: true, platoon: true } },
      acknowledgements: true,
    },
  });
  if (!comm) notFound();

  const ack = comm.acknowledgements[0];
  const prazo = comm.defenseDeadline
    ? new Date(comm.defenseDeadline)
    : ack
    ? calcularPrazoDefesa(new Date(ack.acknowledgedAt))
    : null;

  return (
    <PrintLayout title={`Termo de Ciência — ${comm.protocolNumber}`}>
      <div className="print-section">
        <h2>Termo de Ciência de Comunicação</h2>
        <div className="print-grid">
          <div className="print-field"><label>Protocolo</label><span className="print-protocol">{comm.protocolNumber}</span></div>
          <div className="print-field"><label>Tipo</label><span>{comm.type.name}</span></div>
          <div className="print-field"><label>Data do fato</label><span>{format(new Date(comm.factDate), "dd/MM/yyyy", { locale: ptBR })}</span></div>
          <div className="print-field"><label>Data do registro</label><span>{format(new Date(comm.createdAt), "dd/MM/yyyy", { locale: ptBR })}</span></div>
        </div>
      </div>

      <div className="print-section">
        <h2>Aluno / Comunicado</h2>
        <div className="print-grid">
          <div className="print-field"><label>Nome completo</label><span>{comm.student.fullName}</span></div>
          <div className="print-field"><label>Nome de guerra</label><span>{comm.student.warName}</span></div>
          <div className="print-field"><label>Curso</label><span>{comm.student.course.name}</span></div>
          <div className="print-field"><label>Nº de curso</label><span>{comm.courseNumber}</span></div>
          <div className="print-field"><label>Pelotão</label><span>{comm.student.platoon?.name ?? "—"}</span></div>
        </div>
      </div>

      {prazo && (
        <div className="print-section">
          <h2>Prazo para Apresentação de Defesa</h2>
          <p style={{ fontSize: "11pt" }}>
            O aluno tem até <strong>{format(prazo, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}</strong> (2 dias úteis) para apresentar justificativa ou defesa, caso deseje.
          </p>
          <p style={{ fontSize: "9pt", color: "#555", marginTop: 6 }}>
            Sábados e domingos não são contados no prazo. O não exercício desse direito implica prosseguimento da tramitação normalmente.
          </p>
        </div>
      )}

      {ack && (
        <div className="print-section">
          <h2>Registro de Ciência</h2>
          <div className="print-field"><label>Data da ciência</label><span>{format(new Date(ack.acknowledgedAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</span></div>
          <div className="print-field"><label>Método</label><span>{ack.method ?? "Sistema"}</span></div>
        </div>
      )}

      <div style={{ marginTop: 32, padding: "12px 16px", border: "1px solid #ccc", borderRadius: 6, fontSize: "9pt", background: "#f9fafb" }}>
        <p><strong>Declaro ter tomado ciência</strong> do teor da comunicação referenciada neste termo, ciente dos meus direitos de defesa nos termos do regulamento aplicável.</p>
      </div>

      <div className="print-signatures" style={{ marginTop: 40 }}>
        <div className="print-sig-line">
          <p>{comm.student.warName}</p>
          <p>Aluno — Assinatura</p>
        </div>
        <div className="print-sig-line">
          <p>Setor de Protocolo</p>
          <p>Assinatura e Data</p>
        </div>
      </div>
    </PrintLayout>
  );
}
