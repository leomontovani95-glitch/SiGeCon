"server-only";
import { prisma } from "@/lib/db";
import { comTransacaoRetry, adicionarAoCaderno } from "@/lib/caderno";

const NOTA_AUTO =
  "Prazo de 2 dias úteis encerrado sem que o aluno tomasse ciência ou apresentasse defesa. " +
  "Comunicação encaminhada automaticamente ao Subcomandante/Oficial da Escola para emissão de parecer.";

const NOTA_AUTO_ADAPTACAO =
  "Prazo de 2 dias úteis encerrado sem que o aluno tomasse ciência. " +
  "Comunicação em Período de Adaptação encaminhada automaticamente ao caderno disciplinar, sem impacto na nota de conduta.";

export async function processarPrazosExpirados(): Promise<number> {
  const agora = new Date();

  const expiradas = await prisma.communication.findMany({
    where: {
      status: "AGUARDANDO_CIENCIA",
      defenseDeadline: { lt: agora, not: null },
    },
    include: { student: true, type: true },
  });

  if (expiradas.length === 0) return 0;

  const admin = await prisma.user.findFirst({
    where: { role: "ADMINISTRADOR", active: true },
    select: { id: true },
  });

  for (const comm of expiradas) {
    if (comm.adaptationPeriod) {
      // Período de Adaptação: decisão automática + caderno + sem parecer
      const authorityId = admin?.id ?? comm.reporterId;

      await comTransacaoRetry(async (tx) => {
        await tx.studentAcknowledgement.create({
          data: {
            communicationId: comm.id,
            studentId: comm.studentId,
            method: "PRAZO_EXPIRADO",
            notes: NOTA_AUTO_ADAPTACAO,
          },
        });

        await tx.decision.create({
          data: {
            communicationId: comm.id,
            authorityId,
            decisionType: "Período de Adaptação",
            text: NOTA_AUTO_ADAPTACAO,
            finalScore: 0,
          },
        });

        await tx.communication.update({
          where: { id: comm.id },
          data: { status: "DECIDIDA", finalScore: 0 },
        });

        // Adiciona ao caderno rascunho
        await adicionarAoCaderno(tx, comm.courseId, authorityId, {
          communicationId: comm.id,
          studentId: comm.studentId,
          courseId: comm.courseId,
          platoonId: comm.platoonId,
          studentCourseNumber: comm.courseNumber,
          studentWarName: comm.student.warName,
          recordType: comm.type.name,
          factDate: comm.factDate,
          decisionSummary: "Período de Adaptação",
          shortObservation: "Período de Adaptação",
          score: 0,
        });
      });
    } else {
      // Fluxo normal: encaminha para parecer
      await prisma.$transaction([
        prisma.studentAcknowledgement.create({
          data: {
            communicationId: comm.id,
            studentId: comm.studentId,
            method: "PRAZO_EXPIRADO",
            notes: NOTA_AUTO,
          },
        }),
        prisma.communication.update({
          where: { id: comm.id },
          data: { status: "AGUARDANDO_PARECER" },
        }),
      ]);
    }

    if (admin) {
      await prisma.auditLog.create({
        data: {
          userId: admin.id,
          action: "PRAZO_EXPIRADO_AUTO",
          entity: "Communication",
          entityId: comm.id,
          details: comm.adaptationPeriod ? NOTA_AUTO_ADAPTACAO : NOTA_AUTO,
        },
      });
    }
  }

  if (expiradas.length > 0) {
    console.log(
      `[SiGeCon] ${new Date().toLocaleString("pt-BR")} — ` +
      `${expiradas.length} comunicação(ões) processada(s) automaticamente por prazo expirado.`
    );
  }

  return expiradas.length;
}
