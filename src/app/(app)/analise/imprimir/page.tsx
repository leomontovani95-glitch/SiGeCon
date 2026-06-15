import { prisma } from "@/lib/db";
import { verifySession, getSchoolFilter } from "@/lib/dal";
import { redirect } from "next/navigation";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import PrintLayout from "@/components/PrintLayout";

const PRINT_COLORS = [
  "#1e3a5f", "#2563eb", "#0891b2", "#0d9488",
  "#7c3aed", "#db2777", "#d97706", "#16a34a",
];

const CPI_COLORS_BG: Record<number, string> = {
  0: "#dcfce7",
  1: "#fef9c3",
  2: "#ffedd5",
  3: "#fee2e2",
};
const CPI_COLORS_TEXT: Record<number, string> = {
  0: "#166534",
  1: "#854d0e",
  2: "#9a3412",
  3: "#991b1b",
};

export default async function AnaliseImprimirPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const session = await verifySession();
  if (session.role === "ALUNO") redirect("/acesso-negado");

  const sp         = await searchParams;
  const cursoId    = sp.cursoId    ?? "";
  const platoonId  = sp.platoonId  ?? "";
  const dataInicio = sp.dataInicio ?? "";
  const dataFim    = sp.dataFim    ?? "";

  const school = getSchoolFilter(session.role, session.escola);

  const [cursosDisponiveis, plataoSelecionado] = await Promise.all([
    prisma.course.findMany({
      where: { active: true, ...(school ? { school } : {}) },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    platoonId
      ? prisma.platoon.findUnique({ where: { id: platoonId }, select: { name: true } })
      : Promise.resolve(null),
  ]);

  const courseFilter = cursoId
    ? { courseId: cursoId }
    : school
      ? { course: { school } }
      : {};

  const platoonFilter = platoonId ? { platoonId } : {};

  const dateFilter =
    dataInicio || dataFim
      ? {
          factDate: {
            ...(dataInicio ? { gte: new Date(dataInicio) } : {}),
            ...(dataFim    ? { lte: new Date(dataFim)    } : {}),
          },
        }
      : {};

  const where = { ...courseFilter, ...platoonFilter, ...dateFilter };

  const allComms = await prisma.communication.findMany({
    where,
    select: {
      factDate:  true,
      article:   true,
      item:      true,
      letter:    true,
      studentId: true,
      type: { select: { name: true, score: true, scoreNature: true } },
      student: {
        select: {
          warName: true,
          platoon: { select: { name: true } },
          course:  { select: { name: true } },
        },
      },
      platoon: { select: { name: true } },
    },
  });

  const total = allComms.length;
  const totalCPIs   = allComms.filter((c) => c.type.scoreNature === "DESFAVORAVEL").length;
  const totalFavs   = allComms.filter((c) => c.type.scoreNature === "FAVORAVEL").length;

  // ── 1. Frequência por dia da semana ───────────────────────────────────────
  const diasNomes = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
  const diasCount = new Array(7).fill(0) as number[];
  for (const c of allComms) diasCount[new Date(c.factDate).getDay()]++;
  const maxDia = Math.max(...diasCount, 1);
  const diaSemanaData = diasNomes.map((dia, i) => ({ dia, total: diasCount[i] }));

  // ── 2. Evolução mensal ────────────────────────────────────────────────────
  const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  const monthlyMap = new Map<string, { CPI: number; fav: number }>();
  for (const c of allComms) {
    const d   = new Date(c.factDate);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const prev = monthlyMap.get(key) ?? { CPI: 0, fav: 0 };
    if (c.type.scoreNature === "DESFAVORAVEL") prev.CPI++; else prev.fav++;
    monthlyMap.set(key, prev);
  }
  const evolucaoMensalData = Array.from(monthlyMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, val]) => {
      const [year, month] = key.split("-");
      return { mes: `${MESES[parseInt(month) - 1]}/${year.slice(2)}`, CPI: val.CPI, fav: val.fav };
    });

  // ── 3. Comparativo entre pelotões ─────────────────────────────────────────
  const pelotaoMap = new Map<string, { cpi0: number; cpi1: number; cpi2: number; cpi3: number }>();
  for (const c of allComms) {
    if (!c.type.name.toLowerCase().includes("cpi")) continue;
    const pelotao = c.platoon?.name ?? c.student.platoon?.name ?? "Sem pelotão";
    const prev    = pelotaoMap.get(pelotao) ?? { cpi0: 0, cpi1: 0, cpi2: 0, cpi3: 0 };
    const m       = c.type.name.match(/(\d)/);
    const grau    = m ? Math.min(3, Math.max(0, parseInt(m[1], 10))) : 0;
    if (grau === 0) prev.cpi0++; else if (grau === 1) prev.cpi1++; else if (grau === 2) prev.cpi2++; else prev.cpi3++;
    pelotaoMap.set(pelotao, prev);
  }
  const pelotaoData = Array.from(pelotaoMap.entries())
    .map(([pelotao, cnt]) => ({ pelotao, ...cnt, total: cnt.cpi0 + cnt.cpi1 + cnt.cpi2 + cnt.cpi3 }))
    .sort((a, b) => b.total - a.total);

  // ── 4. Distribuição por tipo ──────────────────────────────────────────────
  const tipoMap = new Map<string, number>();
  for (const c of allComms) tipoMap.set(c.type.name, (tipoMap.get(c.type.name) ?? 0) + 1);
  const tipoData = Array.from(tipoMap.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  // ── 5. Top artigos infringidos ────────────────────────────────────────────
  const artigoMap = new Map<string, number>();
  for (const c of allComms) {
    if (!c.article) continue;
    const key = `Art. ${c.article}${c.item ? ` Inc. ${c.item}` : ""}${c.letter ? ` Al. ${c.letter}` : ""}`;
    artigoMap.set(key, (artigoMap.get(key) ?? 0) + 1);
  }
  const topArtigos = Array.from(artigoMap.entries())
    .map(([dispositivo, count]) => ({ dispositivo, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
  const maxArtigo = topArtigos[0]?.count ?? 1;

  // ── 6. Top 10 alunos ──────────────────────────────────────────────────────
  const alunoMap = new Map<string, { warName: string; courseName: string; platoonName: string; total: number }>();
  for (const c of allComms) {
    const prev = alunoMap.get(c.studentId);
    if (prev) { prev.total++; }
    else {
      alunoMap.set(c.studentId, {
        warName:     c.student.warName,
        courseName:  c.student.course.name,
        platoonName: c.student.platoon?.name ?? "—",
        total: 1,
      });
    }
  }
  const topAlunos = Array.from(alunoMap.values())
    .sort((a, b) => b.total - a.total)
    .slice(0, 10);

  // ── Metadados para o cabeçalho ────────────────────────────────────────────
  const cursoSelecionado = cursosDisponiveis.find((c) => c.id === cursoId);
  const labelEscopo = school === "ESFAP" ? "EsFAP" : school === "ESFO" ? "EsFO" : "Todos os cursos";
  const escopo = [cursoSelecionado?.name ?? labelEscopo, plataoSelecionado?.name].filter(Boolean).join(" · ");

  const periodoLabel =
    dataInicio && dataFim
      ? `${format(new Date(dataInicio), "dd/MM/yyyy", { locale: ptBR })} a ${format(new Date(dataFim), "dd/MM/yyyy", { locale: ptBR })}`
      : dataInicio
        ? `A partir de ${format(new Date(dataInicio), "dd/MM/yyyy", { locale: ptBR })}`
        : dataFim
          ? `Até ${format(new Date(dataFim), "dd/MM/yyyy", { locale: ptBR })}`
          : "Todo o período";

  const extraStyles = `
    .analise-section { margin-bottom: 22px; page-break-inside: avoid; }
    .analise-section h2 {
      font-size: 10pt; font-weight: bold; text-transform: uppercase;
      border-bottom: 1.5px solid #1e3a5f; padding-bottom: 4px;
      margin: 0 0 10px 0; color: #1e3a5f; letter-spacing: 0.5px;
    }
    .analise-section .subtitulo {
      font-size: 8pt; color: #6b7280; margin: -6px 0 10px 0;
    }
    .analise-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
    .summary-cards { display: flex; gap: 12px; margin-bottom: 20px; }
    .summary-card {
      flex: 1; border-radius: 6px; padding: 10px 14px;
      text-align: center; font-size: 9pt;
    }
    .summary-card .valor { font-size: 20pt; font-weight: bold; display: block; }
    .bar-row { display: flex; align-items: center; gap: 8px; margin-bottom: 5px; }
    .bar-row .label { width: 68px; font-size: 8pt; text-align: right; flex-shrink: 0; color: #374151; }
    .bar-row .bar-track { flex: 1; background: #e5e7eb; height: 13px; border-radius: 2px; overflow: hidden; }
    .bar-row .bar-fill  { height: 13px; border-radius: 2px; }
    .bar-row .count { width: 28px; font-size: 8pt; font-weight: bold; text-align: right; flex-shrink: 0; }
    .stacked-bar { display: flex; height: 18px; border-radius: 3px; overflow: hidden; margin-bottom: 8px; }
    .stacked-legend { display: flex; flex-wrap: wrap; gap: 6px 14px; }
    .stacked-legend-item { display: flex; align-items: center; gap: 4px; font-size: 8pt; }
    .legend-dot { width: 10px; height: 10px; border-radius: 2px; flex-shrink: 0; }
    @media print { .analise-grid-2 { break-inside: avoid; } }
  `;

  return (
    <PrintLayout title={`Análise — ${escopo}`} extraStyles={extraStyles}>

      {/* ── Título e filtros ── */}
      <div className="print-section">
        <h2>Análise de Comunicações</h2>
        <p style={{ fontSize: "9pt", color: "#555", marginBottom: "14px" }}>
          <strong>{escopo}</strong>{"  ·  "}{periodoLabel}
        </p>
      </div>

      {/* ── Cards de resumo ── */}
      <div className="summary-cards">
        {[
          { label: "Total de registros", valor: total,      bg: "#1e3a5f", fg: "white" },
          { label: "CPIs / Desfavoráveis", valor: totalCPIs, bg: "#fee2e2", fg: "#991b1b" },
          { label: "Ref. Elogiosas / Favoráveis", valor: totalFavs, bg: "#dcfce7", fg: "#166534" },
          { label: "% Desfavorável", valor: total > 0 ? `${((totalCPIs / total) * 100).toFixed(0)}%` : "—", bg: "#eff6ff", fg: "#1d4ed8" },
        ].map((card) => (
          <div key={card.label} className="summary-card" style={{ background: card.bg, color: card.fg }}>
            <span className="valor">{card.valor}</span>
            {card.label}
          </div>
        ))}
      </div>

      {/* ── Grid 2 colunas: Dia semana + Evolução mensal ── */}
      <div className="analise-grid-2">

        {/* 1 — Frequência por dia da semana */}
        <div className="analise-section">
          <h2>Frequência por Dia da Semana</h2>
          <p className="subtitulo">{total} fatos considerados</p>
          {diaSemanaData.map(({ dia, total: cnt }) => (
            <div key={dia} className="bar-row">
              <span className="label">{dia.slice(0, 3)}.</span>
              <div className="bar-track">
                <div
                  className="bar-fill"
                  style={{ width: `${Math.round((cnt / maxDia) * 100)}%`, background: "#1e3a5f" }}
                />
              </div>
              <span className="count">{cnt}</span>
            </div>
          ))}
        </div>

        {/* 4 — Distribuição por tipo */}
        <div className="analise-section">
          <h2>Distribuição por Tipo</h2>
          <p className="subtitulo">{total} comunicações consideradas</p>
          {total > 0 && (
            <div className="stacked-bar">
              {tipoData.map((t, i) => (
                <div
                  key={t.name}
                  title={`${t.name}: ${t.value}`}
                  style={{
                    width: `${((t.value / total) * 100).toFixed(1)}%`,
                    background: PRINT_COLORS[i % PRINT_COLORS.length],
                  }}
                />
              ))}
            </div>
          )}
          <div className="stacked-legend">
            {tipoData.map((t, i) => (
              <span key={t.name} className="stacked-legend-item">
                <span className="legend-dot" style={{ background: PRINT_COLORS[i % PRINT_COLORS.length] }} />
                {t.name}&nbsp;
                <strong>{t.value}</strong>&nbsp;
                <span style={{ color: "#6b7280" }}>({total > 0 ? ((t.value / total) * 100).toFixed(0) : 0}%)</span>
              </span>
            ))}
          </div>
          {tipoData.length === 0 && (
            <p style={{ fontSize: "8pt", color: "#9ca3af" }}>Sem dados no período.</p>
          )}
        </div>
      </div>

      {/* ── Evolução mensal (tabela) ── */}
      <div className="analise-section">
        <h2>Evolução Mensal</h2>
        <p className="subtitulo">CPIs e Referências Elogiosas por mês</p>
        {evolucaoMensalData.length > 0 ? (
          <table className="print-table">
            <thead>
              <tr>
                <th>Mês</th>
                <th style={{ background: "#991b1b" }}>CPIs / Desfavoráveis</th>
                <th style={{ background: "#166534" }}>Ref. Elogiosas / Favoráveis</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {evolucaoMensalData.map((m) => (
                <tr key={m.mes}>
                  <td style={{ fontWeight: "bold" }}>{m.mes}</td>
                  <td style={{ color: m.CPI > 0 ? "#991b1b" : "#9ca3af", fontWeight: m.CPI > 0 ? "bold" : "normal" }}>
                    {m.CPI}
                  </td>
                  <td style={{ color: m.fav > 0 ? "#166534" : "#9ca3af", fontWeight: m.fav > 0 ? "bold" : "normal" }}>
                    {m.fav}
                  </td>
                  <td style={{ fontWeight: "bold" }}>{m.CPI + m.fav}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p style={{ fontSize: "8pt", color: "#9ca3af" }}>Sem dados no período.</p>
        )}
      </div>

      {/* ── Comparativo entre pelotões ── */}
      <div className="analise-section">
        <h2>Comparativo entre Pelotões</h2>
        <p className="subtitulo">CPIs por pelotão, agrupadas por grau de gravidade</p>
        {pelotaoData.length > 0 ? (
          <table className="print-table">
            <thead>
              <tr>
                <th>Pelotão</th>
                <th style={{ background: "#166534" }}>CPI 0</th>
                <th style={{ background: "#854d0e" }}>CPI 1</th>
                <th style={{ background: "#9a3412" }}>CPI 2</th>
                <th style={{ background: "#991b1b" }}>CPI 3</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {pelotaoData.map((p) => (
                <tr key={p.pelotao}>
                  <td style={{ fontWeight: "bold" }}>{p.pelotao}</td>
                  {[p.cpi0, p.cpi1, p.cpi2, p.cpi3].map((v, gi) => (
                    <td
                      key={gi}
                      style={{
                        background: v > 0 ? CPI_COLORS_BG[gi] : "transparent",
                        color: v > 0 ? CPI_COLORS_TEXT[gi] : "#9ca3af",
                        fontWeight: v > 0 ? "bold" : "normal",
                        textAlign: "center",
                      }}
                    >
                      {v}
                    </td>
                  ))}
                  <td style={{ fontWeight: "bold", textAlign: "center" }}>{p.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p style={{ fontSize: "8pt", color: "#9ca3af" }}>Sem CPIs registradas no período.</p>
        )}
      </div>

      {/* ── Top artigos infringidos ── */}
      <div className="analise-section">
        <h2>Top 10 Artigos Infringidos</h2>
        <p className="subtitulo">{topArtigos.reduce((s, a) => s + a.count, 0)} ocorrências nos {topArtigos.length} dispositivos mais frequentes</p>
        {topArtigos.length > 0 ? (
          <>
            {topArtigos.map(({ dispositivo, count }, i) => (
              <div key={dispositivo} className="bar-row">
                <span className="label" style={{ width: "140px", fontSize: "7.5pt" }}>
                  {i + 1}. {dispositivo}
                </span>
                <div className="bar-track">
                  <div
                    className="bar-fill"
                    style={{ width: `${Math.round((count / maxArtigo) * 100)}%`, background: "#1e3a5f" }}
                  />
                </div>
                <span className="count">{count}</span>
              </div>
            ))}
          </>
        ) : (
          <p style={{ fontSize: "8pt", color: "#9ca3af" }}>Nenhum artigo registrado no período.</p>
        )}
      </div>

      {/* ── Top 10 alunos ── */}
      <div className="analise-section">
        <h2>Top 10 Alunos com Mais Sanções</h2>
        <p className="subtitulo">Alunos com maior número de comunicações no período filtrado</p>
        {topAlunos.length > 0 ? (
          <table className="print-table">
            <thead>
              <tr>
                <th style={{ width: "28px" }}>#</th>
                <th>Nome de guerra</th>
                <th>Curso</th>
                <th>Pelotão</th>
                <th style={{ textAlign: "right" }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {topAlunos.map((a, i) => (
                <tr key={i}>
                  <td style={{ fontWeight: "bold", color: i < 3 ? "#991b1b" : "#6b7280" }}>{i + 1}º</td>
                  <td style={{ fontWeight: "bold" }}>{a.warName}</td>
                  <td>{a.courseName}</td>
                  <td>{a.platoonName}</td>
                  <td
                    style={{
                      textAlign: "right", fontWeight: "bold",
                      color: i === 0 ? "#991b1b" : i < 3 ? "#b45309" : "#1e3a5f",
                    }}
                  >
                    {a.total}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p style={{ fontSize: "8pt", color: "#9ca3af" }}>Sem dados no período.</p>
        )}
      </div>

    </PrintLayout>
  );
}
