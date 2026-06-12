import { prisma } from "@/lib/db";
import { verifySession } from "@/lib/dal";
import { platoonOrder, abreviarPelotao } from "@/lib/utils";
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
        include: {
          student: { include: { course: true, platoon: true } },
          communication: { select: { protocolNumber: true, article: true, item: true, letter: true, bgpmNumber: true, bgpmYear: true } },
        },
      },
      aacp: {
        include: {
          dayGroups: { include: { actions: { orderBy: { order: "asc" } } }, orderBy: { order: "asc" } },
          materiais: { orderBy: { order: "asc" } },
          observacoes: { orderBy: { order: "asc" } },
          dispositivosLegais: { orderBy: { order: "asc" } },
        },
      },
    },
  });
  if (!caderno) notFound();
  caderno.items.sort((a, b) => {
    const pa = platoonOrder(a.student.platoon?.name);
    const pb = platoonOrder(b.student.platoon?.name);
    if (pa !== pb) return pa - pb;
    return (parseInt(a.studentCourseNumber, 10) || 0) - (parseInt(b.studentCourseNumber, 10) || 0);
  });
  return caderno;
}

function fmtEnq(art: string | null, inc: string | null, al: string | null) {
  if (!art) return "—";
  let s = `Art. ${art}`;
  if (inc) s += `, ${inc}`;
  if (al)  s += `, ${al})`;
  return s;
}

function fmtOrigEnq(art: string | null, inc: string | null, al: string | null): string {
  if (!art) return "—";
  let s = `Enquad. orig. ${art}`;
  if (inc) s += `, ${inc}`;
  if (al)  s += `, ${al})`;
  return s;
}

function fmtBGPM(num: string | null | undefined, year: string | null | undefined): string | null {
  if (!num || !year) return null;
  return `BGPM Nº ${num.padStart(3, "0")}/${year}`;
}

function normalizarPeriodo(p: string): string {
  // Substitui cada token de hora individualmente
  return p.replace(/\d+h\d*(?:min)?/gi, (token) => {
    let t = token.replace(/(?:min)$/i, ""); // remove sufixo "min"
    t = t.replace(/h00$/, "h");             // 08h00 → 08h
    return t;
  });
}

function obsCell(item: Item): string {
  if (item.decisionSummary === "Reenquadrar artigo") {
    return fmtOrigEnq(item.originalArticle ?? null, item.originalItem ?? null, item.originalLetter ?? null);
  }
  const TD_TAC = new Set(["TD Leve", "TD Média", "TD Grave", "TAC", "Elogio publicado em BI"]);
  if (TD_TAC.has(item.recordType)) {
    return fmtBGPM(item.communication.bgpmNumber, item.communication.bgpmYear) ?? item.shortObservation ?? "—";
  }
  return item.shortObservation ?? "—";
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
          <col className="cd-col-obs" />
          <col className="cd-col-pont" />
        </colgroup>
        <thead>
          <tr>
            <th className="cd-col-proto">Protocolo</th>
            <th className="cd-col-enq">Enquad.</th>
            <th className="cd-col-pel">Pel</th>
            <th className="cd-col-num">Nº</th>
            <th className="cd-col-nome">Nome</th>
            <th className="cd-col-data">Data</th>
            <th className="cd-col-obs">Obs.</th>
            <th className="cd-col-pont" style={{ textAlign: "right" }}>Pont.</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td className="cd-col-proto" style={{ fontFamily: "monospace", fontSize: "6pt" }}>
                {item.communication.protocolNumber}
              </td>
              <td className="cd-col-enq" style={{ color: "#1e3a8a" }}>
                {isTdTac
                  ? item.recordType
                  : fmtEnq(item.communication.article, item.communication.item, item.communication.letter)}
              </td>
              <td className="cd-col-pel">{abreviarPelotao(item.student.platoon?.name)}</td>
              <td className="cd-col-num" style={{ fontFamily: "monospace", textAlign: "center" }}>
                {item.studentCourseNumber}
              </td>
              <td className="cd-col-nome" style={{ fontWeight: "bold" }}>{item.studentWarName}</td>
              <td className="cd-col-data">{format(new Date(item.factDate), "dd/MM/yyyy", { locale: ptBR })}</td>
              <td className="cd-col-obs" style={{ color: "#666" }}>{obsCell(item)}</td>
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

type AacpData = NonNullable<Awaited<ReturnType<typeof fetchCaderno>>["aacp"]>;
type CadernoMeta = { number: number; course?: { name: string; school?: string | null } | null; school?: string | null };
type ChefeUser = { rank: string; fullName: string } | null;

function AACPAnexo({ aacp, caderno, chefe }: { aacp: AacpData; caderno: CadernoMeta; chefe: ChefeUser }) {
  const sat = new Date(aacp.saturdayDate);
  const sun = new Date(aacp.sundayDate);
  const numero = `${String(caderno.number).padStart(2, "0")}/${sat.getFullYear()}`;
  const cursosNome = caderno.course?.name ?? "—";
  const escola = (caderno.course?.school ?? caderno.school) as string | null | undefined;
  const efetivoDicente = escola === "ESFAP" ? "Conforme Caderno Disciplinar EsFAP"
    : escola === "ESFO" ? "Conforme Caderno Disciplinar EsFO"
    : "Conforme Caderno Disciplinar";
  const fmtDate = (d: Date) => format(d, "dd/MM/yyyy", { locale: ptBR });
  const dateStr = sat.toDateString() === sun.toDateString()
    ? fmtDate(sat)
    : `${fmtDate(sat)} e ${fmtDate(sun)}`;

  // Monta linhas da tabela com rowSpan para DIA e CPI
  type Row = {
    showDay: boolean; daySpan: number; dayLabel: string;
    showCpi: boolean; cpiSpan: number; cpiLabel: string;
    acao: string; periodo: string; key: string;
  };
  const rows: Row[] = [];
  const DAY_ORDER = ["SABADO", "DOMINGO"];
  const byDay = new Map<string, typeof aacp.dayGroups>();
  for (const g of aacp.dayGroups) {
    if (!byDay.has(g.day)) byDay.set(g.day, []);
    byDay.get(g.day)!.push(g);
  }
  const orderedDays = [...DAY_ORDER.filter(d => byDay.has(d)), ...[...byDay.keys()].filter(d => !DAY_ORDER.includes(d))];
  for (const day of orderedDays) {
    const dGroups = byDay.get(day)!;
    const dayTotal = dGroups.reduce((s, g) => s + g.actions.length, 0);
    let dayShown = false;
    for (const group of dGroups) {
      let grpShown = false;
      for (const action of group.actions) {
        rows.push({
          showDay: !dayShown, daySpan: dayTotal,
          dayLabel: day === "SABADO" ? "SÁBADO" : day === "DOMINGO" ? "DOMINGO" : day,
          showCpi: !grpShown, cpiSpan: group.actions.length, cpiLabel: group.cpiLabel,
          acao: action.acao, periodo: action.periodo, key: action.id,
        });
        if (!grpShown) grpShown = true;
        if (!dayShown) dayShown = true;
      }
    }
  }

  const cell: React.CSSProperties = { border: "1px solid #000", padding: "3px 7px" };
  const hdr: React.CSSProperties = { fontWeight: "bold" };

  return (
    <div style={{ fontFamily: "Arial, sans-serif", fontSize: "8pt", color: "#000" }}>

      {/* Cabeçalho institucional — mesmo padrão do PrintLayout */}
      <div className="print-header">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-pmes.png" alt="PMES" className="print-header-logo" width={68} height={68} />
        <div className="print-header-text">
          <p className="linha1">Governo do Estado do Espírito Santo</p>
          <p className="linha2">Polícia Militar</p>
          <p className="linha3">Academia de Polícia Militar</p>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brasao-apm.png" alt="APM/ES" className="print-header-logo" width={68} height={68} />
      </div>

      {/* Bloco de identificação */}
      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 6, fontSize: "8pt" }}>
        <tbody>
          <tr>
            <td style={{ ...cell, fontWeight: "bold", textAlign: "center", textTransform: "uppercase", letterSpacing: "0.3px", width: "75%" }}>
              Atividades de Ajuste de Conduta Profissional
            </td>
            <td rowSpan={2} style={{ ...cell, fontWeight: "bold", textAlign: "center", verticalAlign: "middle", whiteSpace: "nowrap" }}>
              Nº {numero}
            </td>
          </tr>
          <tr>
            <td style={{ ...cell, textAlign: "center", fontWeight: "bold" }}>{cursosNome}</td>
          </tr>
          <tr>
            <td colSpan={2} style={cell}><span style={hdr}>LOCAL DE REALIZAÇÃO: </span>{aacp.local}</td>
          </tr>
          <tr>
            <td colSpan={2} style={cell}><span style={hdr}>DATA: </span>{dateStr}</td>
          </tr>
          <tr>
            <td colSpan={2} style={cell}><span style={hdr}>FISCALIZAÇÃO: </span>{aacp.fiscalizacao}</td>
          </tr>
          <tr>
            <td colSpan={2} style={cell}><span style={hdr}>EFETIVO DISCENTE: </span>{efetivoDicente}</td>
          </tr>
        </tbody>
      </table>

      {/* Tabela de desenvolvimento */}
      <table className="aacp-table" style={{ marginBottom: 5 }}>
        <thead>
          <tr>
            <th style={{ width: "10%", textAlign: "center" }}>DIA</th>
            <th style={{ width: "8%", textAlign: "center" }}>CPI</th>
            <th style={{ width: "67%" }}>AÇÕES</th>
            <th style={{ width: "15%", textAlign: "center" }}>PERÍODO</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr key={row.key}>
              {row.showDay && (
                <td rowSpan={row.daySpan}
                  style={{ textAlign: "center", fontWeight: "bold", verticalAlign: "middle", padding: "3px 8px" }}>
                  {row.dayLabel}
                </td>
              )}
              {row.showCpi && (
                <td rowSpan={row.cpiSpan}
                  style={{ textAlign: "center", verticalAlign: "middle", padding: "3px 6px" }}>
                  {row.cpiLabel}
                </td>
              )}
              <td style={{ whiteSpace: "normal" }}>{row.acao}</td>
              <td style={{ textAlign: "center", whiteSpace: "nowrap" }}>{normalizarPeriodo(row.periodo)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Seções inferiores */}
      {[
        { label: "Material Necessário", items: aacp.materiais },
        { label: "Observações", items: aacp.observacoes },
        { label: "Dispositivos Legais", items: aacp.dispositivosLegais },
      ].map(sec => sec.items.length > 0 && (
        <div key={sec.label} style={{ marginBottom: 5, border: "1px solid #000" }}>
          <p style={{ margin: 0, fontWeight: "bold", textAlign: "center", textTransform: "uppercase", fontSize: "7pt", background: "#f3f4f6", padding: "2px 0", borderBottom: "1px solid #000" }}>
            {sec.label}
          </p>
          <div style={{ padding: "3px 8px" }}>
            {sec.items.map((item) => (
              <p key={item.id} style={{ margin: "1px 0", fontSize: "7.5pt" }}>— {item.text}</p>
            ))}
          </div>
        </div>
      ))}

      {/* Rodapé */}
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "7pt", marginTop: 6, marginBottom: 12 }}>
        <span>VERSÃO: {String(aacp.versao).padStart(2, "0")}</span>
        <span>LAVRADO EM: {format(new Date(), "dd/MM/yyyy", { locale: ptBR })}</span>
      </div>

      {/* Assinatura */}
      {chefe && (
        <div className="print-signatures" style={{ marginTop: 48 }}>
          <div className="print-sig-line" style={{ gridColumn: "1 / -1", maxWidth: 400, margin: "0 auto" }}>
            <p style={{ fontWeight: "bold" }}>{chefe.rank} {chefe.fullName}</p>
            <p>Chefe da Divisão Acadêmica</p>
          </div>
        </div>
      )}
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
  const [comandante, chefeDivisao] = await Promise.all([
    schoolRole
      ? prisma.user.findFirst({
          where: {
            active: true,
            OR: [{ role: schoolRole }, { additionalRoles: { contains: schoolRole } }],
          },
        })
      : Promise.resolve(caderno.publishedBy ?? null),
    prisma.user.findFirst({
      where: {
        active: true,
        OR: [{ role: "CHEFE_DIVISAO_ACADEMICA" }, { additionalRoles: { contains: "CHEFE_DIVISAO_ACADEMICA" } }],
      },
    }),
  ]);

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
      @page { size: A4 portrait; margin: 8mm 5mm 12mm 5mm; }
      .print-page, .extra-page { padding: 2mm 3mm 12mm 3mm !important; }
    }
    .cd-table { width: 100%; border-collapse: collapse; font-size: 7pt; table-layout: fixed; }
    .cd-table th { background: #1e3a5f; color: white; padding: 4px 5px; font-size: 6.5pt; text-align: left; overflow: hidden; white-space: nowrap; }
    .cd-table td { padding: 3px 4px; border-bottom: 1px solid #e5e7eb; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; vertical-align: middle; }
    .cd-table tr:nth-child(even) td { background: #f9fafb; }
    .cd-col-proto { width: 19%; }
    .cd-col-enq   { width: 11%; }
    .cd-col-pel   { width: 7%; }
    .cd-col-num   { width: 5%; }
    .cd-col-nome  { width: 18%; }
    .cd-col-data  { width: 15%; }
    .cd-col-obs   { width: 20%; white-space: normal !important; }
    .cd-col-pont  { width: 5%; text-align: right; }
    .aacp-table { width: 100%; border-collapse: collapse; font-size: 7.5pt; table-layout: fixed; }
    .aacp-table th { background: #1e3a5f; color: white; padding: 4px 5px; font-size: 7pt; text-align: left; border: 1px solid #000; }
    .aacp-table td { padding: 3.5px 5px; border: 1px solid #000; vertical-align: middle; }
  `;

  return (
    <PrintLayout
      title={`Caderno Disciplinar ${numero}`}
      extraStyles={extraStyles}
      extraPages={caderno.aacp ? [
        <AACPAnexo key="aacp" aacp={caderno.aacp} caderno={caderno} chefe={chefeDivisao} />
      ] : undefined}
    >

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
