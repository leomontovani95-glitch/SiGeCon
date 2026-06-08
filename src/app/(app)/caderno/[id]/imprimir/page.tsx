import { prisma } from "@/lib/db";
import { verifySession } from "@/lib/dal";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import PrintLayout from "@/components/PrintLayout";

type Item = Awaited<ReturnType<typeof fetchCaderno>>["items"][number];

async function fetchCaderno(id: string) {
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
  return caderno;
}

function fmtEnq(art: string | null, inc: string | null, al: string | null) {
  if (!art) return "—";
  let s = `Art. ${art}`;
  if (inc) s += `, Inc. ${inc}`;
  if (al)  s += `, Al. ${al}`;
  return s;
}

// Definição dos grupos na ordem de exibição
const isArquivadoPDF = (i: Item) =>
  i.recordType === "Arquivamento" ||
  (i.decisionSummary ?? "").toLowerCase().includes("arquiv");

const TD_TAC_SET = new Set(["TD Leve", "TD Média", "TD Grave", "TAC"]);

const GRUPOS: { label: string; note?: string; isTdTac?: boolean; filter: (i: Item) => boolean }[] = [
  { label: "CPI 0", note: "Equivale a 50% dos pontos da CPI 1 (−0,1 pt por ocorrência)",
                         filter: (i) => i.recordType === "CPI 0"                 && i.decisionSummary !== "Reenquadrar artigo" && !isArquivadoPDF(i) },
  { label: "CPI 1",     filter: (i) => i.recordType === "CPI 1"                 && i.decisionSummary !== "Reenquadrar artigo" && !isArquivadoPDF(i) },
  { label: "CPI 2",     filter: (i) => i.recordType === "CPI 2"                 && i.decisionSummary !== "Reenquadrar artigo" && !isArquivadoPDF(i) },
  { label: "CPI 3",     filter: (i) => i.recordType === "CPI 3"                 && i.decisionSummary !== "Reenquadrar artigo" && !isArquivadoPDF(i) },
  { label: "TD / TAC — Transgressões Disciplinares e Termos de Ajuste de Conduta",
    isTdTac: true,       filter: (i) => TD_TAC_SET.has(i.recordType)             && i.decisionSummary !== "Reenquadrar artigo" && !isArquivadoPDF(i) },
  { label: "Referências Elogiosas",     filter: (i) => i.recordType === "Referência Elogiosa"   && !isArquivadoPDF(i) },
  { label: "Elogios publicados em BI",  filter: (i) => i.recordType === "Elogio publicado em BI" && !isArquivadoPDF(i) },
  { label: "Reenquadramentos",          filter: (i) => i.decisionSummary === "Reenquadrar artigo" },
  { label: "Arquivamentos",             filter: (i) => isArquivadoPDF(i) },
];

function TabelaTipo({ items, label, note, isTdTac }: { items: Item[]; label: string; note?: string; isTdTac?: boolean }) {
  if (items.length === 0) return null;
  return (
    <div className="print-section" style={{ marginTop: 24, pageBreakInside: "avoid" }}>
      <h3 style={{
        fontSize: "8.5pt", fontWeight: "bold", color: "#1e3a5f",
        textTransform: "uppercase", letterSpacing: "0.05em",
        borderBottom: "1.5px solid #1e3a5f", paddingBottom: 3, marginBottom: note ? 2 : 6,
      }}>
        {label} <span style={{ fontWeight: "normal", color: "#6b7280" }}>({items.length})</span>
      </h3>
      {note && (
        <p style={{ fontSize: "7.5pt", color: "#6b7280", fontStyle: "italic", marginBottom: 6 }}>
          Obs.: {note}
        </p>
      )}
      <table className="cd-table">
        <colgroup>
          <col className="cd-col-proto" />
          <col className="cd-col-enq" />
          <col className="cd-col-pel" />
          <col className="cd-col-num" />
          <col className="cd-col-nome" />
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
            <th className="cd-col-data">Data</th>
            <th className="cd-col-dec">Decisão</th>
            <th className="cd-col-obs">Obs.</th>
            <th className="cd-col-pont" style={{ textAlign: "right" }}>Pont.</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td className="cd-col-proto" style={{ fontFamily: "monospace", fontSize: "7pt" }}>
                {item.communication.protocolNumber}
              </td>
              <td className="cd-col-enq" style={{ color: "#1e3a8a", fontSize: "7pt" }}>
                {isTdTac
                  ? item.decisionSummary
                  : fmtEnq(item.communication.article, item.communication.item, item.communication.letter)}
              </td>
              <td className="cd-col-pel">{item.student.platoon?.name ?? "—"}</td>
              <td className="cd-col-num" style={{ fontFamily: "monospace", textAlign: "center" }}>
                {item.studentCourseNumber}
              </td>
              <td className="cd-col-nome" style={{ fontWeight: "bold" }}>{item.studentWarName}</td>
              <td className="cd-col-data">{format(new Date(item.factDate), "dd/MM/yyyy", { locale: ptBR })}</td>
              <td className="cd-col-dec">{isTdTac ? "Sanção" : item.decisionSummary}</td>
              <td className="cd-col-obs" style={{ fontSize: "7pt", color: "#666" }}>{item.shortObservation ?? "—"}</td>
              <td className="cd-col-pont" style={{ textAlign: "right", fontWeight: "bold" }}>
                {item.score != null
                  ? (["Referência Elogiosa", "Elogio publicado em BI"].includes(item.recordType)
                      ? `+${Math.abs(item.score).toFixed(1)}`
                      : `−${Math.abs(item.score).toFixed(1)}`)
                  : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function ImprimirCadernoPage({ params }: { params: Promise<{ id: string }> }) {
  await verifySession();
  const { id } = await params;
  const caderno = await fetchCaderno(id);

  // Escola efetiva: campo direto do caderno ou herdado do curso vinculado
  const escolaEfetiva = caderno.school ?? caderno.course?.school ?? null;

  const schoolRole = escolaEfetiva === "ESFAP" ? "COMANDANTE_ESFAP"
    : escolaEfetiva === "ESFO" ? "COMANDANTE_ESFO"
    : null;
  const comandante = schoolRole
    ? await prisma.user.findFirst({ where: { role: schoolRole, active: true } })
    : caderno.publishedBy ?? null;

  const schoolLabel = escolaEfetiva === "ESFAP" ? "EsFAP"
    : escolaEfetiva === "ESFO" ? "EsFO"
    : "Escola";

  const numero = caderno.course
    ? `CD Nº ${String(caderno.number).padStart(2, "0")} — ${caderno.course.name}`
    : `CD-${String(caderno.number).padStart(4, "0")}`;

  const itens = caderno.items;

  // Conta total por grupo para o resumo
  const grupos = GRUPOS.map((g) => ({ ...g, itens: itens.filter(g.filter) }));
  const totalRegistros = itens.length;

  const extraStyles = `
    @media print {
      @page { size: A4 landscape; margin: 12mm 12mm 12mm 15mm; }
      .print-page { padding: 0 !important; box-shadow: none !important; width: auto !important; }
    }
    @media screen { .print-page { width: 270mm !important; } }
    .cd-table { width: 100%; border-collapse: collapse; font-size: 7.5pt; table-layout: fixed; }
    .cd-table th { background: #1e3a5f; color: white; padding: 4px 5px; font-size: 7pt; text-align: left; overflow: hidden; white-space: nowrap; }
    .cd-table td { padding: 3.5px 5px; border-bottom: 1px solid #e5e7eb; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; vertical-align: middle; }
    .cd-table tr:nth-child(even) td { background: #f9fafb; }
    .cd-col-proto { width: 16%; }
    .cd-col-enq   { width: 11%; }
    .cd-col-pel   { width: 9%; }
    .cd-col-num   { width: 4%; }
    .cd-col-nome  { width: 10%; }
    .cd-col-data  { width: 9%; }
    .cd-col-dec   { width: 26%; white-space: normal !important; }
    .cd-col-obs   { width: 8%; }
    .cd-col-pont  { width: 5%; text-align: right; }
  `;

  return (
    <PrintLayout title={`Caderno Disciplinar ${numero}`} extraStyles={extraStyles}>

      {/* Cabeçalho */}
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
          <div className="print-field"><label>Total de registros</label><span>{totalRegistros}</span></div>
        </div>
      </div>

      {/* Tabelas separadas por tipo */}
      {grupos.map((g) => (
        <TabelaTipo key={g.label} label={g.label} note={g.note} isTdTac={g.isTdTac} items={g.itens} />
      ))}

      {totalRegistros === 0 && (
        <div className="print-section">
          <p style={{ textAlign: "center", color: "#9ca3af", fontSize: "9pt" }}>Nenhum registro neste caderno.</p>
        </div>
      )}

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
