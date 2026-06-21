import { prisma } from "@/lib/db";
import { verifySession, temVistaRestritaComunicacao, getSchoolFilter } from "@/lib/dal";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import PrintLayout from "@/components/PrintLayout";
import { escolaHeaderLabel } from "@/lib/utils";

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
      defenses: true,
      opinions: { include: { author: true, attachments: true } },
      decisions: { include: { authority: true, attachments: true } },
      communicantUser: { include: { student: { include: { course: true, platoon: true } } } },
    },
  });
  if (!comm) notFound();

  // Controle de acesso espelhando a tela da comunicação.
  const ehEsteAluno = comm.student.userId === session.userId;
  const ehComunicante = comm.communicantUserId === session.userId && !ehEsteAluno;
  if (session.role === "ALUNO") {
    if (!ehEsteAluno && !ehComunicante) notFound();
  } else {
    // Isolamento por escola: staff fora do escopo não imprime a comunicação.
    const escopo = getSchoolFilter(session.role, session.escola);
    if (escopo && comm.student.course.school !== escopo) notFound();
  }

  // Vista restrita: o PDF sai apenas com o registro/andamento — sem defesa/
  // justificativa do aluno, parecer nem decisão. Vale para o aluno comunicante
  // e para os perfis de apoio (Chefe de Curso e Setor de Protocolo).
  const vistaRestrita = ehComunicante || temVistaRestritaComunicacao(session.role);

  const isCPI = comm.type.name.startsWith("CPI");
  const docTitle = isCPI ? `CPI — ${comm.protocolNumber}` : `Referência Elogiosa — ${comm.protocolNumber}`;

  return (
    <PrintLayout title={docTitle} escola={escolaHeaderLabel(comm.student.course.school)}>
      <div className="print-section">
        <h2>{isCPI ? "Conduta Profissional Inadequada (CPI)" : "Referência Elogiosa"}</h2>
        <div className="print-field">
          <label>Número de Protocolo</label>
          <span className="print-protocol">{comm.protocolNumber}</span>
        </div>
        <div className="print-field">
          <label>Tipo</label>
          <span>{comm.type.name} — Pontuação: {comm.type.score.toFixed(1)} ponto(s)</span>
        </div>
      </div>

      <div className="print-section">
        <h2>Dados do Comunicado / Aluno</h2>
        <div className="print-grid">
          <div className="print-field"><label>Nome completo</label><span>{comm.student.fullName}</span></div>
          <div className="print-field"><label>Nome de guerra</label><span>{comm.student.warName}</span></div>
          <div className="print-field"><label>Curso</label><span>{comm.student.course.name}</span></div>
          <div className="print-field"><label>Nº de curso</label><span>{comm.courseNumber}</span></div>
          <div className="print-field"><label>Pelotão</label><span>{comm.student.platoon?.name ?? "—"}</span></div>
          <div className="print-field"><label>RG</label><span>{comm.student.rg}</span></div>
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

      {!vistaRestrita && comm.defenses.length > 0 && (
        <div className="print-section">
          <h2>Justificativa / Defesa do Aluno</h2>
          {comm.defenses.map((d) => (
            <div key={d.id}>
              <p className="print-text">{d.text}</p>
              <p style={{ fontSize: "8pt", color: "#000", marginTop: 4 }}>
                Apresentada em {format(new Date(d.submittedAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                {d.isLate ? " (FORA DO PRAZO)" : ""}
              </p>
            </div>
          ))}
        </div>
      )}

      {!vistaRestrita && comm.opinions.length > 0 && (
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
              <p style={{ fontSize: "8pt", color: "#000" }}>{o.author.fullName} — {o.authorRole.replace(/_/g, " ")} — {format(new Date(o.createdAt), "dd/MM/yyyy", { locale: ptBR })}</p>
            </div>
          ))}
        </div>
      )}

      {!vistaRestrita && comm.decisions.length > 0 && (
        <div className="print-section">
          <h2>Decisão do Comandante da Escola</h2>
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
              <p style={{ fontSize: "8pt", color: "#000", marginTop: 4 }}>{d.authority.fullName} — {d.authority.role.replace(/_/g, " ")} — {format(new Date(d.decidedAt), "dd/MM/yyyy", { locale: ptBR })}</p>
            </div>
          ))}
        </div>
      )}

      <div className="print-section">
        <h2>Comunicante</h2>
        {comm.communicantUser ? (
          /* Comunicante cadastrado — exibir dados completos */
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
          /* Comunicante preenchido manualmente */
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

    </PrintLayout>
  );
}
