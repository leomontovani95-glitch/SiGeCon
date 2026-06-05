import { prisma } from "@/lib/db";
import { verifySession } from "@/lib/dal";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import PrintLayout from "@/components/PrintLayout";

export default async function ImprimirCadernoPage({ params }: { params: Promise<{ id: string }> }) {
  await verifySession();
  const { id } = await params;

  const caderno = await prisma.disciplinaryBook.findUnique({
    where: { id },
    include: {
      publishedBy: true,
      createdBy: true,
      course: true,
      items: {
        orderBy: [{ studentCourseNumber: "asc" }],
        include: {
          student: { include: { course: true, platoon: true } },
          communication: { select: { protocolNumber: true, article: true, item: true, letter: true } },
        },
      },
    },
  });
  if (!caderno) notFound();

  // Busca o comandante da escola do caderno para usar como assinante
  const schoolRole = caderno.school === "ESFAP" ? "COMANDANTE_ESFAP"
    : caderno.school === "ESFO" ? "COMANDANTE_ESFO"
    : null;
  const comandante = schoolRole
    ? await prisma.user.findFirst({ where: { role: schoolRole, active: true } })
    : caderno.publishedBy ?? null;

  const schoolLabel = caderno.school === "ESFAP" ? "EsFAP"
    : caderno.school === "ESFO" ? "EsFO"
    : "Escola";

  const numero = caderno.course
    ? `CD Nº ${String(caderno.number).padStart(2, "0")} — ${caderno.course.name}`
    : `CD-${String(caderno.number).padStart(4, "0")}`;

  function fmtEnq(art: string | null, inc: string | null, al: string | null) {
    if (!art) return "—";
    let s = `Art. ${art}`;
    if (inc) s += `, Inc. ${inc}`;
    if (al) s += `, Al. ${al}`;
    return s;
  }

  return (
    <PrintLayout title={`Caderno Disciplinar ${numero}`}>
      {/* Força orientação paisagem e fonte compacta para a tabela */}
      <style>{`
        @media print {
          @page { size: A4 landscape; margin: 12mm 12mm 12mm 15mm; }
          .print-page { padding: 0 !important; box-shadow: none !important; width: auto !important; }
        }
        @media screen {
          .print-page { width: 270mm !important; }
        }
        .cd-table {
          width: 100%; border-collapse: collapse; font-size: 7.5pt;
          table-layout: fixed;
        }
        .cd-table th {
          background: #1e3a5f; color: white;
          padding: 5px 5px; font-size: 7pt; text-align: left;
          overflow: hidden; white-space: nowrap;
        }
        .cd-table td {
          padding: 4px 5px; border-bottom: 1px solid #e5e7eb;
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
          vertical-align: middle;
        }
        .cd-table tr:nth-child(even) td { background: #f9fafb; }
        /* Larguras fixas por coluna */
        .cd-col-proto   { width: 13%; }
        .cd-col-enq     { width: 14%; }
        .cd-col-pel     { width: 8%; }
        .cd-col-num     { width: 5%; }
        .cd-col-nome    { width: 10%; }
        .cd-col-tipo    { width: 12%; }
        .cd-col-data    { width: 8%; }
        .cd-col-dec     { width: 20%; white-space: normal !important; }
        .cd-col-obs     { width: 5%; }
        .cd-col-pont    { width: 5%; text-align: right; }
      `}</style>

      <div className="print-section">
        <h2>Caderno Disciplinar — {numero}</h2>
        <div className="print-grid">
          <div className="print-field">
            <label>Data de publicação</label>
            <span>{caderno.publicationDate ? format(new Date(caderno.publicationDate), "dd/MM/yyyy", { locale: ptBR }) : "Não publicado"}</span>
          </div>
          <div className="print-field"><label>Situação</label><span>{caderno.status === "PUBLICADO" ? "Publicado" : "Rascunho"}</span></div>
          {caderno.publishedBy && (
            <div className="print-field">
              <label>Publicado por</label>
              <span>{caderno.publishedBy.rank} {caderno.publishedBy.warName}</span>
            </div>
          )}
          <div className="print-field"><label>Total de registros</label><span>{caderno.items.length}</span></div>
        </div>
      </div>

      <div className="print-section">
        <h2>Registros</h2>
        <table className="cd-table">
          <colgroup>
            <col className="cd-col-proto" />
            <col className="cd-col-enq" />
            <col className="cd-col-pel" />
            <col className="cd-col-num" />
            <col className="cd-col-nome" />
            <col className="cd-col-tipo" />
            <col className="cd-col-data" />
            <col className="cd-col-dec" />
            <col className="cd-col-obs" />
            <col className="cd-col-pont" />
          </colgroup>
          <thead>
            <tr>
              <th className="cd-col-proto">Protocolo</th>
              <th className="cd-col-enq">Enquadramento</th>
              <th className="cd-col-pel">Pelotão</th>
              <th className="cd-col-num">Nº</th>
              <th className="cd-col-nome">Nome de Guerra</th>
              <th className="cd-col-tipo">Tipo</th>
              <th className="cd-col-data">Data</th>
              <th className="cd-col-dec">Decisão</th>
              <th className="cd-col-obs">Obs.</th>
              <th className="cd-col-pont" style={{ textAlign: "right" }}>Pont.</th>
            </tr>
          </thead>
          <tbody>
            {caderno.items.map((item) => (
              <tr key={item.id}>
                <td className="cd-col-proto" style={{ fontFamily: "monospace", fontSize: "7pt" }}>
                  {item.communication.protocolNumber}
                </td>
                <td className="cd-col-enq" style={{ color: "#1e3a8a", fontSize: "7pt" }}>
                  {fmtEnq(item.communication.article, item.communication.item, item.communication.letter)}
                </td>
                <td className="cd-col-pel">{item.student.platoon?.name ?? "—"}</td>
                <td className="cd-col-num" style={{ fontFamily: "monospace", textAlign: "center" }}>
                  {item.studentCourseNumber}
                </td>
                <td className="cd-col-nome" style={{ fontWeight: "bold" }}>{item.studentWarName}</td>
                <td className="cd-col-tipo">{item.recordType}</td>
                <td className="cd-col-data">{format(new Date(item.factDate), "dd/MM/yyyy", { locale: ptBR })}</td>
                <td className="cd-col-dec">{item.decisionSummary}</td>
                <td className="cd-col-obs" style={{ fontSize: "7pt", color: "#666" }}>{item.shortObservation ?? "—"}</td>
                <td className="cd-col-pont" style={{ textAlign: "right", fontWeight: "bold" }}>
                  {item.score != null ? item.score.toFixed(1) : "—"}
                </td>
              </tr>
            ))}
            {caderno.items.length === 0 && (
              <tr><td colSpan={10} style={{ textAlign: "center", color: "#888", padding: "16px" }}>Nenhum registro.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {comandante && (
        <div className="print-signatures" style={{ marginTop: 48 }}>
          <div className="print-sig-line" style={{ gridColumn: "1 / -1", maxWidth: 400, margin: "0 auto" }}>
            <p style={{ fontWeight: "bold" }}>{comandante.rank} {comandante.fullName}</p>
            <p>Comandante da {schoolLabel}</p>
          </div>
        </div>
      )}
    </PrintLayout>
  );
}
