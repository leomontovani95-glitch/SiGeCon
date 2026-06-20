import { prisma } from "@/lib/db";
import { verifySession } from "@/lib/dal";
import { usuarioAtivoNaFuncao } from "@/lib/signatarios";
import { platoonOrder, abreviarPelotao, escolaHeaderLabel, formatCadernoNumero } from "@/lib/utils";
import { coresTipo } from "@/lib/coresComunicacao";
import { ehCpi1Metade, OBS_CPI1_METADE } from "@/lib/pontuacao";
import { nomeExtensoCurso } from "@/lib/cursos";
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
          communication: { select: { protocolNumber: true, article: true, item: true, letter: true, bgpmNumber: true, bgpmYear: true, adaptationPeriod: true } },
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

// Título do curso para o caderno: nome por extenso (maiúsculas) + sigla.
// Ex.: "CFO 2" -> "CURSO DE FORMAÇÃO DE OFICIAIS 2º ANO - CFO 2".
function cursoTitulo(name: string | null | undefined): string | null {
  if (!name) return null;
  return `${nomeExtensoCurso(name).toUpperCase()} - ${name}`;
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
  if (item.communication.adaptationPeriod) return "Período de Adaptação";
  if (item.decisionSummary === "Reenquadrar artigo") {
    return fmtOrigEnq(item.originalArticle ?? null, item.originalItem ?? null, item.originalLetter ?? null);
  }
  const TD_TAC = new Set(["TD Leve", "TD Média", "TD Grave", "TAC", "Elogio publicado em BI"]);
  if (TD_TAC.has(item.recordType)) {
    return fmtBGPM(item.communication.bgpmNumber, item.communication.bgpmYear) ?? item.shortObservation ?? "—";
  }
  // CPI 1 do Art. 146, I (a/b): vale 50% da pontuação de CPI 1 (0,1 em vez de
  // 0,2). Sinaliza na Observação quando houve sanção (não arquivado/reenquadrado,
  // já tratados acima).
  if (item.recordType === "CPI 1" && ehCpi1Metade(item.communication.article, item.communication.item)) {
    return item.shortObservation ?? OBS_CPI1_METADE;
  }
  return item.shortObservation ?? "—";
}

// Definição dos grupos na ordem de exibição
const isArquivadoPDF = (i: Item) =>
  i.recordType === "Arquivamento" ||
  (i.decisionSummary ?? "").toLowerCase().includes("arquiv");

const TD_TAC_SET = new Set(["TD Leve", "TD Média", "TD Grave", "TAC"]);

// Cor identificadora de cada tipo (fonte única em coresComunicacao):
// - título da seção usa a cor só na fonte (sem barra preenchida);
// - o cabeçalho da tabela (Protocolo, Enquad...) é a barra colorida.
const GRUPOS: { label: string; short: string; note?: string; isTdTac?: boolean; bar: string; barText: string; title: string; filter: (i: Item) => boolean }[] = [
  { label: "CPI 1",     short: "CPI 1", ...coresTipo("CPI 1"), filter: (i) => i.recordType === "CPI 1"                 && i.decisionSummary !== "Reenquadrar artigo" && !isArquivadoPDF(i) },
  { label: "CPI 2",     short: "CPI 2", ...coresTipo("CPI 2"), filter: (i) => i.recordType === "CPI 2"                 && i.decisionSummary !== "Reenquadrar artigo" && !isArquivadoPDF(i) },
  { label: "CPI 3",     short: "CPI 3", ...coresTipo("CPI 3"), filter: (i) => i.recordType === "CPI 3"                 && i.decisionSummary !== "Reenquadrar artigo" && !isArquivadoPDF(i) },
  { label: "Reenquadramentos",          short: "Reenq.", ...coresTipo("Reenquadramento"), filter: (i) => i.decisionSummary === "Reenquadrar artigo" },
  { label: "TD / TAC — Transgressões Disciplinares e Termos de Ajuste de Conduta",
    short: "TD/TAC", isTdTac: true,       ...coresTipo("TD / TAC"), filter: (i) => TD_TAC_SET.has(i.recordType)             && i.decisionSummary !== "Reenquadrar artigo" && !isArquivadoPDF(i) },
  { label: "Referências Elogiosas",     short: "Ref. Elog.", ...coresTipo("Referência Elogiosa"), filter: (i) => i.recordType === "Referência Elogiosa"   && !isArquivadoPDF(i) },
  { label: "Elogios publicados em BI",  short: "Elogio BI", ...coresTipo("Elogio publicado em BI"), filter: (i) => i.recordType === "Elogio publicado em BI" && !isArquivadoPDF(i) },
  { label: "Arquivamentos",             short: "Arquiv.", ...coresTipo("Arquivamento"), filter: (i) => isArquivadoPDF(i) },
];

function TabelaTipo({ items, label, note, isTdTac, bar, barText, title }: { items: Item[]; label: string; note?: string; isTdTac?: boolean; bar: string; barText: string; title: string }) {
  if (items.length === 0) return null;
  return (
    <div className="print-section" style={{ marginTop: 24, pageBreakInside: "avoid" }}>
      {/* Título sem barra/borda: texto centralizado, maior, na cor do nível. */}
      <h3 style={{
        fontSize: "11pt", fontWeight: "bold", color: title,
        textTransform: "uppercase", letterSpacing: "0.05em",
        textAlign: "center", margin: "0 0 5px", padding: 0,
      }}>
        {label}
      </h3>
      {note && (
        <p style={{ fontSize: "7.5pt", color: "#6b7280", fontStyle: "italic", textAlign: "center", marginBottom: 6 }}>
          Obs.: {note}
        </p>
      )}
      <table className="cd-table">
        <colgroup>
          <col className="cd-col-pel" />
          <col className="cd-col-num" />
          <col className="cd-col-nome" />
          <col className="cd-col-proto" />
          <col className="cd-col-enq" />
          <col className="cd-col-data" />
          <col className="cd-col-obs" />
          <col className="cd-col-pont" />
        </colgroup>
        <thead style={{ background: bar, color: barText }}>
          <tr>
            <th className="cd-col-pel">Pel</th>
            <th className="cd-col-num">Nº</th>
            <th className="cd-col-nome">Nome</th>
            <th className="cd-col-proto">Protocolo</th>
            <th className="cd-col-enq">Enquad.</th>
            <th className="cd-col-data">Data</th>
            <th className="cd-col-obs">Observação</th>
            <th className="cd-col-pont">Pont.</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td className="cd-col-pel">{abreviarPelotao(item.student.platoon?.name)}</td>
              <td className="cd-col-num" style={{ fontFamily: "monospace", textAlign: "center" }}>
                {item.studentCourseNumber}
              </td>
              <td className="cd-col-nome" style={{ fontWeight: "bold" }}>{item.studentWarName}</td>
              <td className="cd-col-proto" style={{ fontFamily: "monospace", fontSize: "6pt" }}>
                {item.communication.protocolNumber}
              </td>
              <td className="cd-col-enq" style={{ color: "#1e3a8a" }}>
                {isTdTac
                  ? item.recordType
                  : fmtEnq(item.communication.article, item.communication.item, item.communication.letter)}
              </td>
              <td className="cd-col-data">{format(new Date(item.factDate), "dd/MM/yyyy", { locale: ptBR })}</td>
              <td className="cd-col-obs" style={{ color: "#666" }}>{obsCell(item)}</td>
              <td className="cd-col-pont" style={{ fontWeight: "bold" }}>
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
type CadernoMeta = { number: number; year: number; course?: { name: string; school?: string | null } | null; school?: string | null };
type ChefeUser = { rank: string; fullName: string } | null;

function AACPAnexo({ aacp, caderno, chefe }: { aacp: AacpData; caderno: CadernoMeta; chefe: ChefeUser }) {
  const sat = new Date(aacp.saturdayDate);
  const sun = new Date(aacp.sundayDate);
  const numero = `${String(caderno.number).padStart(2, "0")}/${caderno.year}`;
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
          dayLabel: day === "SABADO"
            ? format(sat, "EEEE", { locale: ptBR }).toUpperCase()
            : day === "DOMINGO"
              ? format(sun, "EEEE", { locale: ptBR }).toUpperCase()
              : day.toUpperCase(),
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
          <p className="linha4">{escolaHeaderLabel(escola)}</p>
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
      <div style={{ fontSize: "7pt", marginTop: 6, marginBottom: 12, textAlign: "right" }}>
        <span>LAVRADO EM: {format(new Date(), "dd/MM/yyyy", { locale: ptBR })}</span>
      </div>

      {/* Assinatura — função sempre preenchida; nome em branco se não houver
          titular ativo na função no momento da geração. */}
      <div className="print-signatures" style={{ marginTop: 48 }}>
        <div className="print-sig-line" style={{ gridColumn: "1 / -1", maxWidth: 400, margin: "0 auto" }}>
          <p style={{ fontWeight: "bold" }}>{chefe ? `${chefe.rank} ${chefe.fullName}` : " "}</p>
          <p>Chefe da Divisão Acadêmica</p>
        </div>
      </div>
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
  // Assinatura sempre com o titular ATIVO da função no momento da geração:
  // Comandante da escola (caderno) e Chefe da Divisão Acadêmica (AACP).
  const [comandante, chefeDivisao] = await Promise.all([
    schoolRole
      ? usuarioAtivoNaFuncao(schoolRole)
      : Promise.resolve(caderno.publishedBy ?? null),
    usuarioAtivoNaFuncao("CHEFE_DIVISAO_ACADEMICA"),
  ]);

  const schoolLabel = escolaEfetiva === "ESFAP" ? "EsFAP"
    : escolaEfetiva === "ESFO" ? "EsFO"
    : "Escola";

  const numero = formatCadernoNumero(caderno);

  // Bloco de título: curso por extenso e nº do caderno / ano de criação.
  // (A escola aparece no cabeçalho institucional, via prop do PrintLayout.)
  const cursoLinha = caderno.course ? cursoTitulo(caderno.course.name) : null;
  const cadernoLinha = `CADERNO DISCIPLINAR Nº ${String(caderno.number).padStart(2, "0")}/${caderno.year}`;

  const itens = caderno.items;

  // Conta total por grupo para o resumo
  const grupos = GRUPOS.map((g) => ({ ...g, itens: itens.filter(g.filter) }));
  const totalRegistros = itens.length;

  const extraStyles = `
    @media print {
      @page { size: A4 portrait; margin: 8mm 5mm 12mm 5mm; }
      .print-page, .extra-page { padding: 2mm 3mm 12mm 3mm !important; }
    }
    .cd-table { width: 100%; border-collapse: separate; border-spacing: 0; font-size: 7pt; table-layout: fixed; border: 1px solid #d1d5db; border-radius: 6px; }
    .cd-table th { padding: 4px 5px; font-size: 6.5pt; text-align: center; text-transform: uppercase; font-weight: bold; overflow: hidden; white-space: nowrap; border-right: 1px solid #d1d5db; border-bottom: 1px solid #d1d5db; }
    .cd-table td { padding: 3px 4px; border-right: 1px solid #d1d5db; border-bottom: 1px solid #d1d5db; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; vertical-align: middle; text-align: center; }
    .cd-table tr > *:last-child { border-right: none; }
    .cd-table tbody tr:last-child td { border-bottom: none; }
    .cd-table thead th:first-child { border-top-left-radius: 5px; }
    .cd-table thead th:last-child { border-top-right-radius: 5px; }
    .cd-table tbody tr:last-child td:first-child { border-bottom-left-radius: 5px; }
    .cd-table tbody tr:last-child td:last-child { border-bottom-right-radius: 5px; }
    .cd-table tr:nth-child(even) td { background: #f9fafb; }
    .cd-col-proto { width: 19%; }
    .cd-col-enq   { width: 11%; }
    .cd-col-pel   { width: 7%; }
    .cd-col-num   { width: 5%; }
    .cd-col-nome  { width: 18%; }
    .cd-col-data  { width: 15%; }
    .cd-col-obs   { width: 20%; white-space: normal !important; }
    .cd-col-pont  { width: 5%; text-align: center; }
    .aacp-table { width: 100%; border-collapse: collapse; font-size: 7.5pt; table-layout: fixed; }
    .aacp-table th { background: #1e3a5f; color: white; padding: 4px 5px; font-size: 7pt; text-align: left; border: 1px solid #000; }
    .aacp-table td { padding: 3.5px 5px; border: 1px solid #000; vertical-align: middle; }
    .cd-title-block { text-align: center; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid #ccc; }
    .cd-title-block p { margin: 0 0 3px 0; color: #1e3a5f; font-weight: bold; letter-spacing: 0.5px; line-height: 1.3; }
    .cd-title-block .cd-curso   { font-size: 11pt; }
    .cd-title-block .cd-caderno { font-size: 12.5pt; margin-top: 5px; }
    .cd-meta-row { display: grid; grid-template-columns: 1fr 1fr 1fr; align-items: flex-end; gap: 16px; }
    .cd-meta-row .print-field { margin-bottom: 0; }
    .cd-counts { display: flex; flex-wrap: wrap; justify-content: center; align-items: baseline; gap: 2px 0; margin-top: 7px; padding-top: 5px; border-top: 1px solid #e5e7eb; }
    .cd-count { font-size: 8pt; color: #6b7280; white-space: nowrap; padding: 0 12px; border-right: 1px solid #d1d5db; }
    .cd-count:last-child { border-right: none; }
    .cd-count strong { font-size: 9.5pt; color: #1e3a5f; margin-right: 2px; }
    .cd-header-section { margin-bottom: 4px !important; }
    .cd-header-section + .print-section { margin-top: 12px !important; }
  `;

  return (
    <PrintLayout
      title={`Caderno Disciplinar ${numero}`}
      escola={escolaHeaderLabel(escolaEfetiva)}
      repeatHeader
      extraStyles={extraStyles}
      extraPages={caderno.aacp ? [
        <AACPAnexo key="aacp" aacp={caderno.aacp} caderno={caderno} chefe={chefeDivisao} />
      ] : undefined}
    >

      {/* Cabeçalho */}
      <div className="print-section cd-header-section">
        <div className="cd-title-block">
          {cursoLinha && <p className="cd-curso">{cursoLinha}</p>}
          <p className="cd-caderno">{cadernoLinha}</p>
        </div>
        <div className="cd-meta-row">
          <div className="print-field">
            <label>Data de publicação</label>
            <span>{caderno.publicationDate ? format(new Date(caderno.publicationDate), "dd/MM/yyyy", { locale: ptBR }) : "Não publicado"}</span>
          </div>
          <div className="print-field" style={{ textAlign: "center" }}>
            <label>Total de registros</label>
            <span>{totalRegistros}</span>
          </div>
          <div className="print-field" style={{ textAlign: "right" }}>
            <label>Situação</label>
            <span>{caderno.status === "PUBLICADO" ? "Publicado" : "Rascunho"}</span>
          </div>
        </div>
        {/* Quantidade de cada tipo (omitindo os zerados), centralizado */}
        {totalRegistros > 0 && (
          <div className="cd-counts">
            {grupos.filter((g) => g.itens.length > 0).map((g) => (
              <span key={g.label} className="cd-count">
                <strong style={{ color: g.title }}>{g.itens.length}</strong> {g.short}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Tabelas separadas por tipo */}
      {grupos.map((g) => (
        <TabelaTipo key={g.label} label={g.label} note={g.note} isTdTac={g.isTdTac} bar={g.bar} barText={g.barText} title={g.title} items={g.itens} />
      ))}

      {totalRegistros === 0 && (
        <div className="print-section">
          <p style={{ textAlign: "center", color: "#9ca3af", fontSize: "9pt" }}>Nenhum registro neste caderno.</p>
        </div>
      )}

      {(comandante || schoolRole) && (
        <div className="print-signatures" style={{ marginTop: 48 }}>
          <div className="print-sig-line" style={{ gridColumn: "1 / -1", maxWidth: 400, margin: "0 auto" }}>
            {/* Função sempre preenchida; nome em branco se não houver titular ativo. */}
            <p style={{ fontWeight: "bold" }}>{comandante ? `${comandante.rank} ${comandante.fullName}` : " "}</p>
            <p>Comandante da {schoolLabel}</p>
          </div>
        </div>
      )}
    </PrintLayout>
  );
}
