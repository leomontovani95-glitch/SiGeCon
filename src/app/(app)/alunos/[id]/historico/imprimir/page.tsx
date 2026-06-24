import { prisma } from "@/lib/db";
import { verifySession } from "@/lib/dal";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import PrintLayout from "@/components/PrintLayout";
import { getHistoricoAluno, STATUS_COMUNICACAO_LABELS as STATUS_LABELS } from "@/lib/historico";
import { formatCourseNumber, escolaHeaderLabel } from "@/lib/utils";

export default async function HistoricoImprimirPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string>>;
}) {
  const session = await verifySession();
  const { id } = await params;
  const sp = await searchParams;
  const adaptacao = sp.adaptacao ?? "";

  const historico = await getHistoricoAluno(id);
  if (!historico) notFound();
  const { aluno, nota, desfavoravel, favoravel, resumo, evolucao } = historico;

  // Aluno só vê o próprio histórico (mesma lógica de historico/page.tsx).
  if (session.role === "ALUNO" && aluno.userId !== session.userId) {
    const atual = await prisma.student.findFirst({ where: { userId: session.userId }, select: { rg: true } });
    if (!atual || atual.rg !== aluno.rg) notFound();
  }

  // Filtro de período de adaptação espelhando o da página do aluno:
  // "nao" → apenas as que descontam/acrescentam pontos (fora do P.A.)
  // "sim" → apenas as do período de adaptação
  // ""    → todas
  const adaptacaoWhere =
    adaptacao === "nao" ? { adaptationPeriod: false } :
    adaptacao === "sim" ? { adaptationPeriod: true }  : {};

  // Todas as comunicações do aluno com detalhes completos, ordenadas por protocolo.
  // Como o aluno é sempre o comunicado (não o comunicante) neste contexto, não há
  // vista restrita — pareceres e decisões são visíveis para fins de transparência.
  const communications = await prisma.communication.findMany({
    where: { studentId: id, ...adaptacaoWhere },
    include: {
      type: true,
      reporter: true,
      witnesses: true,
      acknowledgements: true,
      defenses: { include: { attachments: true } },
      opinions: { include: { author: true, attachments: true } },
      decisions: { include: { authority: true, attachments: true } },
      communicantUser: {
        include: { student: { include: { course: true, platoon: true } } },
      },
    },
    orderBy: { protocolNumber: "asc" },
  });

  return (
    <PrintLayout title={`Histórico Completo — ${aluno.warName}`} escola={escolaHeaderLabel(aluno.course.school)} repeatHeader>
      {/* 80 % de zoom na impressão para cada comunicação caber em uma página. */}
      <style>{`@media print { html { zoom: 0.8; } }`}</style>

      {/* ════════════════════════════════════════════════════════════════════
          PÁGINA 1 — Resumo do histórico (mesmo conteúdo de historico/page.tsx)
          ════════════════════════════════════════════════════════════════════ */}
      <div className="print-section">
        <h2>Histórico do Aluno — Conduta Profissional</h2>
        <div className="print-grid">
          <div className="print-field"><label>Nome completo</label><span>{aluno.fullName}</span></div>
          <div className="print-field"><label>Nome de guerra</label><span>{aluno.warName}</span></div>
          <div className="print-field"><label>Curso</label><span>{aluno.course.name}</span></div>
          <div className="print-field"><label>Nº de curso</label><span>{formatCourseNumber(aluno.courseNumber)}</span></div>
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
                <td key={label} style={{ textAlign: "center", fontWeight: "bold", fontSize: "11pt", padding: "5px 6px", color: value > 0 ? color : "#000" }}>
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
            <p style={{ margin: 0, fontSize: "9pt", color: "#000" }}>Nota base: 10,00 | Cálculo: 10 − desfavorável + favorável</p>
            {nota < 6 && <p style={{ margin: 0, fontSize: "9pt", color: "#7f1d1d", fontWeight: "bold" }}>SITUAÇÃO: REPROVADO (nota abaixo de 6,0)</p>}
            {nota >= 6 && nota < 7 && <p style={{ margin: 0, fontSize: "9pt", color: "#b91c1c", fontWeight: "bold" }}>ATENÇÃO: Zona de risco (nota abaixo de 7,0)</p>}
          </div>
        </div>
      </div>

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
                <td style={{ fontStyle: "italic", color: "#000" }}>Início do curso</td>
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
                    <td style={{ textAlign: "right", fontWeight: "bold", color: variacao < 0 ? "#b91c1c" : variacao > 0 ? "#15803d" : "#000" }}>
                      {variacao === 0 ? "—" : `${variacao > 0 ? "+" : ""}${variacao.toFixed(2)}`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {(() => {
        const commsVisiveis =
          adaptacao === "nao" ? aluno.communications.filter((c) => !c.adaptationPeriod) :
          adaptacao === "sim" ? aluno.communications.filter((c) =>  c.adaptationPeriod) :
          aluno.communications;
        return (
      <div className="print-section">
        {adaptacao === "nao" && <p style={{ fontSize: "9pt", color: "#b45309", marginBottom: 8, fontWeight: "bold" }}>Filtrado: apenas comunicações fora do Período de Adaptação (que afetam a nota)</p>}
        {adaptacao === "sim" && <p style={{ fontSize: "9pt", color: "#b45309", marginBottom: 8, fontWeight: "bold" }}>Filtrado: apenas comunicações do Período de Adaptação</p>}
        <h2>Comunicações ({commsVisiveis.length}{adaptacao ? ` de ${aluno.communications.length}` : ""} total)</h2>
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
            {commsVisiveis.map((c) => (
              <tr key={c.id}>
                <td style={{ fontFamily: "monospace", fontSize: "8pt", whiteSpace: "nowrap" }}>{c.protocolNumber}</td>
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
            {commsVisiveis.length === 0 && (
              <tr><td colSpan={6} style={{ textAlign: "center", color: "#000" }}>{aluno.communications.length === 0 ? "Nenhuma comunicação registrada." : "Nenhuma comunicação encontrada com este filtro."}</td></tr>
            )}
          </tbody>
        </table>
      </div>
        );
      })()}

      {/* ════════════════════════════════════════════════════════════════════
          PÁGINAS SEGUINTES — Uma por comunicação, ordenadas por protocolo.
          Cada div com break-before inicia uma nova página na impressão.
          ════════════════════════════════════════════════════════════════════ */}
      {communications.map((comm) => {
        const isCPI = comm.type.name.startsWith("CPI");
        const docTitle = isCPI
          ? `Conduta Profissional Inadequada (${comm.type.name})`
          : `${comm.type.name}`;

        return (
          <div key={comm.id} style={{ breakBefore: "page", pageBreakBefore: "always" }}>

            <div className="print-section">
              <h2>{docTitle}</h2>
              <div className="print-field">
                <label>Número de Protocolo</label>
                <span className="print-protocol">{comm.protocolNumber}</span>
              </div>
              <div className="print-field">
                <label>Tipo</label>
                <span>{comm.type.name} — Pontuação: {comm.type.score.toFixed(1)} ponto(s)</span>
              </div>
              <div className="print-field">
                <label>Situação</label>
                <span>{STATUS_LABELS[comm.status] ?? comm.status}</span>
              </div>
            </div>

            <div className="print-section">
              <h2>Dados do Comunicado / Aluno</h2>
              <div className="print-grid">
                <div className="print-field"><label>Nome completo</label><span>{aluno.fullName}</span></div>
                <div className="print-field"><label>Nome de guerra</label><span>{aluno.warName}</span></div>
                <div className="print-field"><label>Curso</label><span>{aluno.course.name}</span></div>
                <div className="print-field"><label>Nº de curso</label><span>{comm.courseNumber}</span></div>
                <div className="print-field"><label>Pelotão</label><span>{aluno.platoon?.name ?? "—"}</span></div>
                <div className="print-field"><label>RG</label><span>{aluno.rg}</span></div>
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

            {comm.acknowledgements.some((a) => a.method === "PRAZO_EXPIRADO") && (
              <div className="print-section">
                <h2>Encaminhamento Automático por Prazo Expirado</h2>
                {comm.acknowledgements
                  .filter((a) => a.method === "PRAZO_EXPIRADO")
                  .map((a) => (
                    <div key={a.id}>
                      <p className="print-text">{a.notes}</p>
                      <p style={{ fontSize: "8pt", color: "#000", marginTop: 4 }}>
                        Processado automaticamente em {format(new Date(a.acknowledgedAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </p>
                    </div>
                  ))}
              </div>
            )}

            {(() => {
              const comDefesa  = comm.defenses.length > 0;
              const semDefesa  = comm.acknowledgements.some((a) => a.method === "SEM_DEFESA");
              if (!comDefesa && !semDefesa) return null;
              return (
                <div className="print-section">
                  <h2>Posição do Aluno</h2>
                  {comDefesa ? (
                    comm.defenses.map((d) => (
                      <div key={d.id}>
                        <p className="print-text">{d.text}</p>
                        <p style={{ fontSize: "8pt", color: "#000", marginTop: 4 }}>
                          Defesa apresentada em {format(new Date(d.submittedAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                          {d.isLate ? " (FORA DO PRAZO)" : ""}
                        </p>
                        {d.attachments.length > 0 && (
                          <p style={{ fontSize: "8pt", color: "#000", marginTop: 4 }}>
                            Anexo(s): {d.attachments.map((a) => a.fileName).join(", ")}
                          </p>
                        )}
                      </div>
                    ))
                  ) : (
                    <p className="print-text" style={{ fontStyle: "italic" }}>
                      {comm.type.name.toLowerCase().includes("elogiosa")
                        ? "O aluno tomou ciência da Referência Elogiosa."
                        : comm.adaptationPeriod
                        ? "O aluno tomou ciência da comunicação e não há apresentação de defesa por se tratar de comunicação em Período de Adaptação."
                        : "O aluno tomou ciência da comunicação e optou por não apresentar justificativa/defesa."}
                    </p>
                  )}
                </div>
              );
            })()}

            {comm.opinions.length > 0 && (
              <div className="print-section">
                <h2>Parecer</h2>
                {comm.opinions.map((o) => (
                  <div key={o.id}>
                    <p className="print-text">{o.text}</p>
                    {o.recommendation && <p style={{ fontWeight: "bold", marginTop: 4, fontSize: "10pt" }}>Recomendação: {o.recommendation}</p>}
                    {o.attachments.length > 0 && (
                      <p style={{ fontSize: "8pt", color: "#000", marginTop: 4 }}>
                        Anexo(s): {o.attachments.map((a) => a.fileName).join(", ")}
                      </p>
                    )}
                    <p style={{ fontSize: "8pt", color: "#000" }}>
                      {o.author.fullName} — {o.authorRole.replace(/_/g, " ")} — {format(new Date(o.createdAt), "dd/MM/yyyy", { locale: ptBR })}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {comm.decisions.length > 0 && (
              <div className="print-section">
                <h2>Decisão</h2>
                {comm.decisions.map((d) => (
                  <div key={d.id}>
                    <p style={{ fontWeight: "bold", fontSize: "11pt", marginBottom: 4 }}>{d.decisionType}</p>
                    <p className="print-text">{d.text}</p>
                    {d.finalScore != null && (
                      <p style={{ fontWeight: "bold", marginTop: 6 }}>Pontuação aplicada: {d.finalScore.toFixed(1)} ponto(s)</p>
                    )}
                    {d.attachments.length > 0 && (
                      <p style={{ fontSize: "8pt", color: "#000", marginTop: 4 }}>
                        Anexo(s): {d.attachments.map((a) => a.fileName).join(", ")}
                      </p>
                    )}
                    <p style={{ fontSize: "8pt", color: "#000", marginTop: 4 }}>
                      {d.authority.fullName} — {d.authority.role.replace(/_/g, " ")} — {format(new Date(d.decidedAt), "dd/MM/yyyy", { locale: ptBR })}
                    </p>
                  </div>
                ))}
              </div>
            )}

            <div className="print-section">
              <h2>Comunicante</h2>
              {comm.communicantUser ? (
                <div className="print-grid">
                  <div className="print-field"><label>Nome completo</label><span>{comm.communicantUser.fullName}</span></div>
                  <div className="print-field"><label>Nome de guerra</label><span>{comm.communicantUser.warName}</span></div>
                  <div className="print-field"><label>Posto/Graduação</label><span>{comm.communicantUser.rank}</span></div>
                  <div className="print-field"><label>RG</label><span>{comm.communicantUser.rg}</span></div>
                  {comm.communicantUser.functionalNumber && (
                    <div className="print-field"><label>Nº Funcional</label><span>{comm.communicantUser.functionalNumber}</span></div>
                  )}
                  {comm.communicantUser.student && (
                    <>
                      <div className="print-field"><label>Curso</label><span>{comm.communicantUser.student.course.name}</span></div>
                      <div className="print-field"><label>Nº de curso</label><span>{comm.communicantUser.student.courseNumber}</span></div>
                      <div className="print-field"><label>Pelotão</label><span>{comm.communicantUser.student.platoon?.name ?? "—"}</span></div>
                    </>
                  )}
                </div>
              ) : (
                <div className="print-grid">
                  <div className="print-field"><label>Comunicante</label><span>{comm.communicantName ?? "—"}</span></div>
                </div>
              )}
            </div>

            <div className="print-section">
              <h2>Registro da Comunicação</h2>
              <div className="print-grid">
                <div className="print-field"><label>Registrado por</label><span>{comm.reporter.rank} {comm.reporter.warName}</span></div>
                <div className="print-field"><label>Data do registro</label><span>{format(new Date(comm.createdAt), "dd/MM/yyyy", { locale: ptBR })}</span></div>
              </div>
            </div>

          </div>
        );
      })}

    </PrintLayout>
  );
}
