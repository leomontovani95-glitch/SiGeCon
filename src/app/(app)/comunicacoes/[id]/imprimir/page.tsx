import { prisma } from "@/lib/db";
import { verifySession, temVistaRestritaComunicacao, getSchoolFilter } from "@/lib/dal";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import PrintLayout from "@/components/PrintLayout";
import { escolaHeaderLabel } from "@/lib/utils";
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

// Grade 3 colunas: esquerda · centro · direita
const GRID3: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr 1fr",
  gap: "6px 16px",
};
// Coluna central mais larga — usada quando o nome completo ocupa o centro
const GRID3W: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 2fr 1fr",
  gap: "6px 16px",
};
const COL_L: React.CSSProperties = { textAlign: "left" };
const COL_C: React.CSSProperties = { textAlign: "center" };
const COL_R: React.CSSProperties = { textAlign: "right" };

export default async function ImprimirComunicacaoPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await verifySession();
  const { id } = await params;

  const comm = await prisma.communication.findUnique({
    where: { id },
    include: {
      type: true,
      student: { include: { course: true, platoon: true } },
      reporter: true,
      manualRule: true,
      witnesses: true,
      acknowledgements: true,
      defenses: { include: { attachments: true } },
      opinions: { include: { author: true, attachments: true } },
      decisions: { include: { authority: true, attachments: true } },
      communicantUser: { include: { student: { include: { course: true, platoon: true } } } },
    },
  });
  if (!comm) notFound();

  const ehEsteAluno   = comm.student.userId === session.userId;
  const ehComunicante = comm.communicantUserId === session.userId && !ehEsteAluno;
  if (session.role === "ALUNO") {
    if (!ehEsteAluno && !ehComunicante) notFound();
  } else {
    const escopo = getSchoolFilter(session.role, session.escola);
    if (escopo && comm.student.course.school !== escopo) notFound();
  }

  const vistaRestrita = ehComunicante || temVistaRestritaComunicacao(session.role);

  const isCPI     = comm.type.name.startsWith("CPI");
  const docTitle  = isCPI ? `CPI — ${comm.protocolNumber}` : `Referência Elogiosa — ${comm.protocolNumber}`;

  // Pontuação: usa finalScore (se já decidido) ou o padrão do tipo
  const scoreVal  = comm.finalScore ?? comm.type.score;
  const scoreSign = comm.type.scoreNature === "DESFAVORAVEL" ? "−" : "+";
  const scoreStr  = `${scoreSign}${scoreVal.toFixed(1).replace(".", ",")} ponto`;
  const tipoDisplay = `${comm.type.name} (${scoreStr})`;

  // Situação: label direto do status, sem lógica adicional
  const situacaoDisplay = STATUS_ABREV[comm.status] ?? comm.status;

  // Dispositivo legal com descrição da alínea entre parênteses
  const dispositivoParts: string[] = [];
  if (comm.article) dispositivoParts.push(`Art. ${comm.article}`);
  if (comm.item)    dispositivoParts.push(`Inc. ${comm.item}`);
  if (comm.letter)  dispositivoParts.push(`Al. ${comm.letter}`);
  const dispositivoBase    = dispositivoParts.join(", ");
  const dispositivoDisplay = comm.manualRule?.description
    ? `${dispositivoBase} (${comm.manualRule.description})`
    : dispositivoBase;

  return (
    <PrintLayout title={docTitle} escola={escolaHeaderLabel(comm.student.course.school)}>

      {/* 1. Protocolo · tipo+pontuação · situação */}
      <div className="print-section">
        <h2>{isCPI ? "Conduta Profissional Inadequada (CPI)" : "Referência Elogiosa"}</h2>
        <div style={GRID3}>
          <div className="print-field" style={COL_L}>
            <label>Nº de Protocolo</label>
            <span>{comm.protocolNumber}</span>
          </div>
          <div className="print-field" style={COL_C}>
            <label>Tipo / Pontuação</label>
            <span>{tipoDisplay}</span>
          </div>
          <div className="print-field" style={COL_R}>
            <label>Situação</label>
            <span>{situacaoDisplay}</span>
          </div>
        </div>
      </div>

      {/* 2. Dados do comunicado — 2×3: NdG|NomeCompleto|Curso / NºCurso|Pelotão|RG */}
      <div className="print-section">
        <h2>Dados do Comunicado / Aluno</h2>
        <div style={GRID3W}>
          <div className="print-field" style={COL_L}><label>Nome de guerra</label><span>{comm.student.warName}</span></div>
          <div className="print-field" style={COL_C}><label>Nome completo</label><span>{comm.student.fullName}</span></div>
          <div className="print-field" style={COL_R}><label>Curso</label><span>{comm.student.course.name}</span></div>
          <div className="print-field" style={COL_L}><label>Nº de curso</label><span>{comm.courseNumber}</span></div>
          <div className="print-field" style={COL_C}><label>Pelotão</label><span>{comm.student.platoon?.name ?? "—"}</span></div>
          <div className="print-field" style={COL_R}><label>RG</label><span>{comm.student.rg}</span></div>
        </div>
      </div>

      {/* 3. Dados do fato — data/hora/local em 3 cols + dispositivo na linha seguinte */}
      <div className="print-section">
        <h2>Dados do Fato</h2>
        <div style={GRID3}>
          <div className="print-field" style={COL_L}>
            <label>Data do fato</label>
            <span>{format(new Date(comm.factDate), "dd/MM/yyyy", { locale: ptBR })}</span>
          </div>
          <div className="print-field" style={COL_C}>
            <label>Hora do fato</label>
            <span>{comm.factTime ?? "—"}</span>
          </div>
          <div className="print-field" style={COL_R}>
            <label>Local</label>
            <span>{comm.factPlace ?? "—"}</span>
          </div>
        </div>
        {dispositivoDisplay && (
          <div className="print-field" style={{ marginTop: 6, ...COL_L }}>
            <label>Dispositivo legal</label>
            <span>{dispositivoDisplay}</span>
          </div>
        )}
      </div>

      {/* 4. Descrição do fato */}
      <div className="print-section">
        <h2>Descrição do Fato</h2>
        <p className="print-text">{comm.factDescription}</p>
      </div>

      {/* 5. Testemunha(s) */}
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

      {/* 6. Encaminhamento por prazo expirado */}
      {!vistaRestrita && comm.acknowledgements.some((a) => a.method === "PRAZO_EXPIRADO") && (
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

      {/* 7. Posição do aluno — defesa ou ciência sem defesa */}
      {!vistaRestrita && (() => {
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
      {!vistaRestrita && comm.opinions.length > 0 && (
        <div className="print-section">
          <h2>Parecer</h2>
          {comm.opinions.map((o) => (
            <div key={o.id}>
              <p className="print-text">{o.text}</p>
              {o.recommendation && (
                <p style={{ fontWeight: "bold", marginTop: 4, fontSize: "10pt" }}>Recomendação: {o.recommendation}</p>
              )}
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
      {!vistaRestrita && comm.decisions.length > 0 && (
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
            /* Aluno do CFO: 2×3 + última linha esq·vazio·dir */
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
                <div className="print-field" style={COL_L}>
                  <label>Nº de curso</label>
                  <span>{comm.communicantUser.student.courseNumber}</span>
                </div>
                <div />
                <div className="print-field" style={COL_R}>
                  <label>Pelotão</label>
                  <span>{comm.communicantUser.student.platoon?.name ?? "—"}</span>
                </div>
              </div>
            </>
          ) : (
            /* Instrutor/servidor: sem dados de curso/pelotão */
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
          /* Comunicante preenchido manualmente */
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

    </PrintLayout>
  );
}
