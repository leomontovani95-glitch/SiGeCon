import { prisma } from "@/lib/db";
import { verifySession } from "@/lib/dal";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import PrintLayout from "@/components/PrintLayout";
import { calcularNotaPublicada, faixaNota } from "@/lib/score";

export default async function HistoricoAlunoPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await verifySession();
  const { id } = await params;

  const [aluno, pubItemsRaw] = await Promise.all([
    prisma.student.findUnique({
      where: { id },
      include: {
        course: true,
        platoon: true,
        communications: {
          include: { type: true, decisions: { include: { authority: true } } },
          orderBy: { factDate: "asc" },
        },
      },
    }),
    prisma.disciplinaryBookItem.findMany({
      where: { studentId: id, disciplinaryBook: { status: "PUBLICADO" } },
      include: {
        communication: { include: { type: { select: { scoreNature: true } } } },
        disciplinaryBook: { select: { id: true, number: true, publicationDate: true, course: { select: { name: true } } } },
      },
      orderBy: { disciplinaryBook: { publicationDate: "asc" } },
    }),
  ]);
  if (!aluno) notFound();

  if (session.role === "ALUNO" && aluno.userId !== session.userId) notFound();

  const pubItems = pubItemsRaw;
  const nota  = calcularNotaPublicada(pubItems);
  const faixa = faixaNota(nota);

  const desfavoravel = pubItems.filter((i) => i.communication.type.scoreNature === "DESFAVORAVEL").reduce((s, i) => s + Math.abs(i.score ?? 0), 0);
  const favoravel    = pubItems.filter((i) => i.communication.type.scoreNature === "FAVORAVEL").reduce((s, i) => s + Math.abs(i.score ?? 0), 0);

  // Contagens por tipo
  const ct = aluno.communications.reduce((acc, c) => { acc[c.type.name] = (acc[c.type.name] ?? 0) + 1; return acc; }, {} as Record<string, number>);
  const resumo = [
    { label: "Total",        value: aluno.communications.length,                              color: "#1e3a5f" },
    { label: "Publicados",   value: pubItems.length,                                           color: "#374151" },
    { label: "P. Adapt.",    value: aluno.communications.filter((c) => c.adaptationPeriod).length, color: "#c2410c" },
    { label: "CPI 0/1",      value: (ct["CPI 0"] ?? 0) + (ct["CPI 1"] ?? 0),                color: "#b45309" },
    { label: "CPI 2",        value: ct["CPI 2"] ?? 0,                                         color: "#b91c1c" },
    { label: "CPI 3",        value: ct["CPI 3"] ?? 0,                                         color: "#7f1d1d" },
    { label: "TD Leve",      value: ct["TD Leve"] ?? 0,                                       color: "#b45309" },
    { label: "TD Média",     value: ct["TD Média"] ?? 0,                                      color: "#b91c1c" },
    { label: "TD Grave",     value: ct["TD Grave"] ?? 0,                                      color: "#7f1d1d" },
    { label: "TAC",          value: ct["TAC"] ?? 0,                                            color: "#7f1d1d" },
    { label: "Arq.",         value: ct["Arquivamento"] ?? 0,                                   color: "#6b7280" },
    { label: "Ref. Elogiosa",value: ct["Referência Elogiosa"] ?? 0,                           color: "#15803d" },
    { label: "Elogio BI",    value: ct["Elogio publicado em BI"] ?? 0,                        color: "#15803d" },
  ];

  // Evolução da nota por caderno publicado
  const cadernosOrdenados = Array.from(
    new Map(
      pubItems
        .filter((i) => i.disciplinaryBook.publicationDate)
        .map((i) => [i.disciplinaryBook.id, i.disciplinaryBook])
    ).values()
  ).sort((a, b) => new Date(a.publicationDate!).getTime() - new Date(b.publicationDate!).getTime());

  const evolucao: { label: string; date: Date; nota: number }[] = [];
  for (const caderno of cadernosOrdenados) {
    const itensTeCaderno = pubItems.filter((i) =>
      new Date(i.disciplinaryBook.publicationDate!).getTime() <= new Date(caderno.publicationDate!).getTime()
    );
    const notaApos = calcularNotaPublicada(itensTeCaderno);
    evolucao.push({
      label: `CD Nº ${String(caderno.number).padStart(2, "0")}${caderno.course ? ` — ${caderno.course.name}` : ""}`,
      date: new Date(caderno.publicationDate!),
      nota: notaApos,
    });
  }

  const STATUS_LABELS: Record<string, string> = {
    REGISTRADA: "Registrada",
    AGUARDANDO_CIENCIA: "Ag. Ciência/Defesa",
    AGUARDANDO_DEFESA: "Ag. Ciência/Defesa",
    JUSTIFICATIVA_APRESENTADA: "Defesa Apresentada", PRAZO_EXPIRADO: "Prazo Expirado",
    AGUARDANDO_PARECER: "Ag. Parecer", AGUARDANDO_DECISAO: "Ag. Decisão",
    DECIDIDA: "Decidida", ARQUIVADA: "Arquivada", PUBLICADA_CADERNO: "Pub. Caderno", FINALIZADA: "Finalizada",
  };

  return (
    <PrintLayout title={`Histórico — ${aluno.warName}`}>
      <div className="print-section">
        <h2>Histórico do Aluno — Conduta Profissional</h2>
        <div className="print-grid">
          <div className="print-field"><label>Nome completo</label><span>{aluno.fullName}</span></div>
          <div className="print-field"><label>Nome de guerra</label><span>{aluno.warName}</span></div>
          <div className="print-field"><label>Curso</label><span>{aluno.course.name}</span></div>
          <div className="print-field"><label>Nº de curso</label><span>{aluno.courseNumber}</span></div>
          <div className="print-field"><label>Pelotão</label><span>{aluno.platoon?.name ?? "—"}</span></div>
          <div className="print-field"><label>RG</label><span>{aluno.rg}</span></div>
          <div className="print-field"><label>Situação</label><span>{aluno.status}</span></div>
          <div className="print-field"><label>Gerado em</label><span>{format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</span></div>
        </div>
      </div>

      <div className="print-section">
        <h2>Resumo de Registros</h2>
        <table className="print-table" style={{ fontSize: "8pt" }}>
          <thead>
            <tr>
              {resumo.map(({ label }) => (
                <th key={label} style={{ textAlign: "center", whiteSpace: "nowrap", padding: "4px 6px" }}>{label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              {resumo.map(({ label, value, color }) => (
                <td key={label} style={{ textAlign: "center", fontWeight: "bold", fontSize: "11pt", padding: "5px 6px", color: value > 0 ? color : "#9ca3af" }}>
                  {value}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      <div className="print-section">
        <h2>Nota da Disciplina Conduta Profissional</h2>
        <div style={{ display: "flex", gap: 24, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ fontSize: "22pt", fontWeight: "bold", padding: "6px 16px", borderRadius: 6, background: nota >= 9 ? "#166534" : nota >= 8 ? "#15803d" : nota >= 7 ? "#b45309" : nota >= 6 ? "#b91c1c" : "#7f1d1d", color: "white" }}>
            {nota.toFixed(2)}
          </div>
          <div>
            <p style={{ margin: 0, fontSize: "10pt" }}>Pontuação desfavorável total: <strong style={{ color: "#b91c1c" }}>−{desfavoravel.toFixed(1)}</strong></p>
            <p style={{ margin: 0, fontSize: "10pt" }}>Pontuação favorável total: <strong style={{ color: "#15803d" }}>+{favoravel.toFixed(1)}</strong></p>
            <p style={{ margin: 0, fontSize: "9pt", color: "#555" }}>Nota base: 10,00 | Cálculo: 10 − desfavorável + favorável</p>
            {nota < 6 && <p style={{ margin: 0, fontSize: "9pt", color: "#7f1d1d", fontWeight: "bold" }}>SITUAÇÃO: REPROVADO (nota abaixo de 6,0)</p>}
            {nota >= 6 && nota < 7 && <p style={{ margin: 0, fontSize: "9pt", color: "#b91c1c", fontWeight: "bold" }}>ATENÇÃO: Zona de risco (nota abaixo de 7,0)</p>}
          </div>
        </div>
      </div>

      {/* Evolução da nota por caderno */}
      {evolucao.length > 1 && (
        <div className="print-section">
          <h2>Evolução da Nota por Caderno Publicado</h2>
          <table className="print-table">
            <thead>
              <tr>
                <th>Caderno</th>
                <th>Data de Publicação</th>
                <th style={{ textAlign: "right" }}>Nota Acumulada</th>
                <th style={{ textAlign: "right" }}>Variação</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ fontStyle: "italic", color: "#888" }}>Início do curso</td>
                <td>—</td>
                <td style={{ textAlign: "right", fontWeight: "bold" }}>10,00</td>
                <td style={{ textAlign: "right" }}>—</td>
              </tr>
              {evolucao.map((e, i) => {
                const anterior = i === 0 ? 10 : evolucao[i - 1].nota;
                const variacao = e.nota - anterior;
                return (
                  <tr key={e.label}>
                    <td style={{ fontFamily: "monospace", fontSize: "8pt" }}>{e.label}</td>
                    <td>{format(e.date, "dd/MM/yyyy", { locale: ptBR })}</td>
                    <td style={{ textAlign: "right", fontWeight: "bold" }}>{e.nota.toFixed(2)}</td>
                    <td style={{ textAlign: "right", fontWeight: "bold", color: variacao < 0 ? "#b91c1c" : variacao > 0 ? "#15803d" : "#888" }}>
                      {variacao === 0 ? "—" : `${variacao > 0 ? "+" : ""}${variacao.toFixed(2)}`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="print-section">
        <h2>Comunicações ({aluno.communications.length} total)</h2>
        <table className="print-table">
          <thead>
            <tr>
              <th>Protocolo</th>
              <th>Tipo</th>
              <th>Data do Fato</th>
              <th>Status</th>
              <th>Pontuação</th>
              <th>Decisão</th>
            </tr>
          </thead>
          <tbody>
            {aluno.communications.map((c) => (
              <tr key={c.id}>
                <td style={{ fontFamily: "monospace", fontSize: "8pt" }}>{c.protocolNumber}</td>
                <td>{c.type.name}</td>
                <td>{format(new Date(c.factDate), "dd/MM/yyyy", { locale: ptBR })}</td>
                <td style={{ fontSize: "8pt" }}>
                  {STATUS_LABELS[c.status] ?? c.status}
                  {c.adaptationPeriod && <span style={{ marginLeft: 4, fontSize: "7pt", fontWeight: "bold", color: "#c2410c", border: "1px solid #c2410c", borderRadius: 3, padding: "0 3px" }}>PA</span>}
                </td>
                <td style={{ textAlign: "right", fontWeight: "bold" }}>
                  {c.finalScore != null ? (
                    <span className={`print-badge ${c.type.scoreNature === "DESFAVORAVEL" ? "badge-desfav" : "badge-fav"}`}>
                      {c.type.scoreNature === "DESFAVORAVEL" ? "−" : "+"}{c.finalScore.toFixed(1)}
                    </span>
                  ) : "—"}
                </td>
                <td style={{ fontSize: "8pt" }}>{c.decisions[0]?.decisionType ?? "—"}</td>
              </tr>
            ))}
            {aluno.communications.length === 0 && (
              <tr><td colSpan={6} style={{ textAlign: "center", color: "#888" }}>Nenhuma comunicação registrada.</td></tr>
            )}
          </tbody>
        </table>
      </div>

    </PrintLayout>
  );
}
