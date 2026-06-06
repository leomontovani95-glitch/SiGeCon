"server-only";
import { prisma } from "@/lib/db";

const NOTA_AUTO =
  "Prazo de 2 dias úteis encerrado sem que o aluno tomasse ciência ou apresentasse defesa. " +
  "Comunicação encaminhada automaticamente ao Subcomandante/Oficial da Escola para emissão de parecer.";

export async function processarPrazosExpirados(): Promise<number> {
  const agora = new Date();

  const expiradas = await prisma.communication.findMany({
    where: {
      status: "AGUARDANDO_CIENCIA",
      defenseDeadline: { lt: agora, not: null },
    },
    select: { id: true, studentId: true },
  });

  if (expiradas.length === 0) return 0;

  // Usa o primeiro ADMINISTRADOR ativo como ator do log de sistema
  const admin = await prisma.user.findFirst({
    where: { role: "ADMINISTRADOR", active: true },
    select: { id: true },
  });

  for (const comm of expiradas) {
    await prisma.$transaction([
      // Registra ciência automática por prazo expirado
      prisma.studentAcknowledgement.create({
        data: {
          communicationId: comm.id,
          studentId: comm.studentId,
          method: "PRAZO_EXPIRADO",
          notes: NOTA_AUTO,
        },
      }),
      // Encaminha para parecer do Subcomandante/Oficial
      prisma.communication.update({
        where: { id: comm.id },
        data: { status: "AGUARDANDO_PARECER" },
      }),
    ]);

    if (admin) {
      await prisma.auditLog.create({
        data: {
          userId: admin.id,
          action: "PRAZO_EXPIRADO_AUTO",
          entity: "Communication",
          entityId: comm.id,
          details: NOTA_AUTO,
        },
      });
    }
  }

  if (expiradas.length > 0) {
    console.log(
      `[SiGeCon] ${new Date().toLocaleString("pt-BR")} — ` +
      `${expiradas.length} comunicação(ões) encaminhada(s) automaticamente por prazo expirado.`
    );
  }

  return expiradas.length;
}
