import { prisma } from "@/lib/db";
import { verifySession } from "@/lib/dal";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import PrintLayout from "@/components/PrintLayout";
import { getHistoricoAluno, STATUS_COMUNICACAO_LABELS as STATUS_LABELS } from "@/lib/historico";
import { formatCourseNumber, escolaHeaderLabel } from "@/lib/utils";
import React from "react";

const STATUS_ABREV: Record<string, string> = {
  REGISTRADA:                "Registrada",
  AGUARDANDO_CIENCIA:        "Ag. Ciência/Defesa",
  AGUARDANDO_DEFESA:         "Ag. Ciência/Defesa",
  JUSTIFICATIVA_APRESENTADA: "Defesa Apresentada",
  PRAZO_EXPIRADO:            "Prazo Expirado",
  AGUARDANDO_PARECER:        "Ag. Parecer",
  PARECER_EMITIDO:           "Parecer Emitido",
  AGUARDANDO_DECISAO:        "Ag. Decisão",
  AGUARDANDO_DECISAO_DIVISAO:"Ag. Decisão (Div.)",
  DECIDIDA:                  "Decidida",
  ARQUIVADA:                 "Arquivada",
  DEVOLVIDA:                 "Devolvida p/ complementação",
  PUBLICADA_CADERNO:         "Decidida/Publicada",
  FINALIZADA:                "Finalizada",
};

const GRID3: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr 1fr",
  gap: "6px 16px",
};
const GRID3W: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 2fr 1fr",
  gap: "6px 16px",
};
const COL_L: React.CSSProperties = { textAlign: "left" };
const COL_C: React.CSSProperties = { textAlign: "center" };
const COL_R: React.CSSProperties = { textAlign: "right" };

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

  // ALUNO só vê o próprio histórico.
  if (session.role === "ALUNO" && aluno.userId !== session.userId) {
    const atual = await prisma.student.findFirst({ where: { userId: session.userId }, select: { rg: true } });
    if (!atual || atual.rg !== aluno.rg) notFound();
  }

  const adaptacaoWhere =
    adaptacao === "nao" ? { adaptationPeriod: false } :
    adaptacao === "sim" ? { adaptationPeriod: true }  : {};

  const communications = await prisma.communication.findMany({
    where: { studentId: id, ...adaptacaoWhere },
    include: {
      type: true,
      reporter: true,
      manualRule: true,
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

  const escolaLabel = escolaHeaderLabel(aluno.course.school);

  // Cabeçalho institucional reutilizado em cada página de comunicação.
  // As classes (print-header, linha1…) são definidas pelo PrintLayout.
  const commHeader = (
    <div className="print-header">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo-pmes.png" alt="PMES" className="print-header-logo" width={68} height={68} loading="eager" />
      <div className="print-header-text">
        <p className="linha1">Governo do Estado do Espírito Santo</p>
        <p className="linha2">Polícia Militar</p>
        <p className="linha3">Academia de Polícia Militar</p>
        {escolaLabel && <p className="linha4">{escolaLabel}</p>}
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brasao-apm-sm.png" alt="APM/ES" className="print-header-logo" width={68} height={68} loading="eager" />
    </div>
  );

  // Cada comunicação vira uma entrada no array extraPages (div.extra-page
  // com break-before:page), garantindo que o page-break funcione no navegador
  // independentemente da estrutura de tabela usada no repeatHeader.
  const commPages = communications.map((comm) => {
    const isCPI = comm.type.name.startsWith("CPI");
    const secTitle = isCPI ? "Conduta Profissional Inadequada (CPI)" : comm.type.name;

    const scoreVal  = comm.finalScore ?? comm.type.score;
    const scoreSign = comm.type.scoreNature === "DESFAVORAVEL" ? "−" : "+";
    const scoreStr  = `${scoreSign}${scoreVal.toFixed(1).replace(".", ",")} ponto`;
    const tipoDisplay = `${comm.type.name} (${scoreStr})`;
    const situacaoDisplay = STATUS_ABREV[comm.status] ?? comm.status;

    const dispositivoParts: string[] = [];
    if (comm.article) dispositivoParts.push(`Art. ${comm.article}`);
    if (comm.item)    dispositivoParts.push(`Inc. ${comm.item}`);
    if (comm.letter)  dispositivoParts.push(`Al. ${comm.letter}`);
    const dispositivoBase    = dispositivoParts.join(", ");
    const dispositivoDisplay = comm.manualRule?.description
      ? `${dispositivoBase} (${comm.manualRule.description})`
      : dispositivoBase;

    return (
      <div key={comm.id}>
        {commHeader}

        {/* 1. Protocolo · tipo+pontuação · situação */}
        <div className="print-section">
          <h2>{secTitle}</h2>
          <div style={GRID3}>
            <div className="print-field" style={COL_L}><label>Nº de Protocolo</label><span>{comm.protocolNumber}</span></div>
            <div className="print-field" style={COL_C}><label>Tipo / Pontuação</label><span>{tipoDisplay}</span></div>
            <div className="print-field" style={COL_R}><label>Situação</label><span>{situacaoDisplay}</span></div>
          </div>
        </div>

        {/* 2. Dados do comunicado */}
        <div className="print-section">
          <h2>Dados do Comunicado / Aluno</h2>
          <div style={GRID3W}>
            <div className="print-field" style={COL_L}><label>Nome de guerra</label><span>{aluno.warName}</span></div>
            <div className="print-field" style={COL_C}><label>Nome completo</label><span>{aluno.fullName}</span></div>
            <div className="print-field" style={COL_R}><label>Curso</label><span>{aluno.course.name}</span></div>
            <div className="print-field" style={COL_L}><label>Nº de curso</label><span>{comm.courseNumber}</span></div>
            <div className="print-field" style={COL_C}><label>Pelotão</label><span>{aluno.platoon?.name ?? "—"}</span></div>
            <div className="print-field" style={COL_R}><label>RG</label><span>{aluno.rg}</span></div>
          </div>
        </div>

        {/* 3. Dados do fato */}
        <div className="print-section">
          <h2>Dados do Fato</h2>
          <div style={GRID3}>
            <div className="print-field" style={COL_L}><label>Data do fato</label><span>{format(new Date(comm.factDate), "dd/MM/yyyy", { locale: ptBR })}</span></div>
            <div className="print-field" style={COL_C}><label>Hora do fato</label><span>{comm.factTime ?? "—"}</span></div>
            <div className="print-field" style={COL_R}><label>Local</label><span>{comm.factPlace ?? "—"}</span></div>
          </div>
          {dispositivoDisplay && (
            <div className="print-field" style={{ marginTop: 6, ...COL_L }}>
              <label>Dispositivo legal</label>
              <span>{dispositivoDisplay}</span>
            </div>
          )}
        </div>

        {/* 4. Descrição */}
        <div className="print-section">
          <h2>Descrição do Fato</h2>
          <p className="print-text">{comm.factDescription}</p>
        </div>

        {/* 5. Testemunhas */}
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

        {/* 6. Prazo expirado */}
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

        {/* 7. Posição do aluno */}
        {(() => {
          const comDefesa = comm.defenses.length > 0;
          const semDefesa = comm.acknowledgements.some((a) => a.method === "SEM_DEFESA");
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

        {/* 8. Parecer */}
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

        {/* 9. Decisão */}
        {comm.decisions.length > 0 && (
          <div className="print-section">
            <h2>Decisão do Comandante da Escola</h2>
            {comm.decisions.map((d) => (
              <div key={d.id}>
                <p style={{ fontWeight: "bold", fontSize: "11pt", marginBottom: 4 }}>{d.decisionType}</p>
                <p className="print-text">{d.text}</p>
                {d.finalScore != null && (
                  <p style={{ fontWeight: "bold", marginTop: 6 }}>
                    Pontuação aplicada: {d.finalScore.toFixed(1).replace(".", ",")} ponto(s)
                  </p>
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

        {/* 10. Comunicante */}
        <div className="print-section">
          <h2>Comunicante</h2>
          {comm.communicantUser ? (
            comm.communicantUser.student ? (
              <>
                <div style={GRID3W}>
                  <div className="print-field" style={COL_L}><label>Nome de guerra</label><span>{comm.communicantUser.warName}</span></div>
                  <div className="print-field" style={COL_C}><label>Nome completo</label><span>{comm.communicantUser.fullName}</span></div>
                  <div className="print-field" style={COL_R}><label>Posto/Graduação</label><span>{comm.communicantUser.rank}</span></div>
                  <div className="print-field" style={COL_L}><label>RG</label><span>{comm.communicantUser.rg}</span></div>
                  <div className="print-field" style={COL_C}><label>Nº Funcional</label><span>{comm.communicantUser.functionalNumber ?? "—"}</span></div>
                  <div className="print-field" style={COL_R}><label>Curso</label><span>{comm.communicantUser.student.course.name}</span></div>
                </div>
                <div style={{ ...GRID3, marginTop: 6 }}>
                  <div className="print-field" style={COL_L}><label>Nº de curso</label><span>{comm.communicantUser.student.courseNumber}</span></div>
                  <div />
                  <div className="print-field" style={COL_R}><label>Pelotão</label><span>{comm.communicantUser.student.platoon?.name ?? "—"}</span></div>
                </div>
              </>
            ) : (
              <div style={GRID3W}>
                <div className="print-field" style={COL_L}><label>Nome de guerra</label><span>{comm.communicantUser.warName}</span></div>
                <div className="print-field" style={COL_C}><label>Nome completo</label><span>{comm.communicantUser.fullName}</span></div>
                <div className="print-field" style={COL_R}><label>Posto/Graduação</label><span>{comm.communicantUser.rank}</span></div>
                <div className="print-field" style={COL_L}><label>RG</label><span>{comm.communicantUser.rg}</span></div>
                <div />
                {comm.communicantUser.functionalNumber && (
                  <div className="print-field" style={COL_R}><label>Nº Funcional</label><span>{comm.communicantUser.functionalNumber}</span></div>
                )}
              </div>
            )
          ) : (
            <div className="print-field" style={COL_L}><label>Comunicante</label><span>{comm.communicantName ?? "—"}</span></div>
          )}
        </div>

        {/* 11. Registro */}
        <div className="print-section">
          <h2>Registro da Comunicação</h2>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 16px" }}>
            <div className="print-field" style={COL_L}><label>Registrado por</label><span>{comm.reporter.rank} {comm.reporter.warName}</span></div>
            <div className="print-field" style={COL_R}><label>Data do registro</label><span>{format(new Date(comm.createdAt), "dd/MM/yyyy", { locale: ptBR })}</span></div>
          </div>
        </div>
      </div>
    );
  });

  const commsVisiveis =
    adaptacao === "nao" ? aluno.communications.filter((c) => !c.adaptationPeriod) :
    adaptacao === "sim" ? aluno.communications.filter((c) =>  c.adaptationPeriod) :
    aluno.communications;

  return (
    <PrintLayout
      title={`Histórico Completo — ${aluno.warName}`}
      escola={escolaLabel}
      extraStyles="@media print { html { zoom: 0.8; } }"
      extraPages={commPages}
    >
      {/* ── PÁGINA 1: resumo do histórico ─────────────────────────────────── */}
      <div className="print-section">
        <h2>Histórico do Aluno — Conduta Profissional</h2>
        <div style={GRID3W}>
          <div className="print-field" style={COL_L}><label>Nome de guerra</label><span>{aluno.warName}</span></div>
          <div className="print-field" style={COL_C}><label>Nome completo</label><span>{aluno.fullName}</span></div>
          <div className="print-field" style={COL_R}><label>Curso</label><span>{aluno.course.name}</span></div>
          <div className="print-field" style={COL_L}><label>Nº de curso</label><span>{formatCourseNumber(aluno.courseNumber)}</span></div>
          <div className="print-field" style={COL_C}><label>Pelotão</label><span>{aluno.platoon?.name ?? "—"}</span></div>
          <div className="print-field" style={COL_R}><label>RG</label><span>{aluno.rg}</span></div>
          <div className="print-field" style={COL_L}><label>Situação</label><span>{aluno.status}</span></div>
          <div className="print-field" style={COL_C}></div>
          <div className="print-field" style={COL_R}><label>Gerado em</label><span>{format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</span></div>
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
    </PrintLayout>
  );
}
