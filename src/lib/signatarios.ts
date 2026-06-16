import "server-only";
import { prisma } from "@/lib/db";
import { effectiveRoles } from "@/lib/roles";

// Retorna o usuário ATIVO que ocupa a função informada — seja como papel
// principal, seja como função acumulada (additionalRoles). A correspondência é
// EXATA por token (não substring): assim "SUBCOMANDANTE_ESFO" não é confundido
// com "COMANDANTE_ESFO". Determinístico: prefere o atualizado mais recentemente.
//
// Usado para preencher a assinatura do caderno disciplinar (Comandante da escola)
// e do AACP (Chefe da Divisão Acadêmica) com quem está efetivamente ATIVO na
// função no momento da geração do documento.
export async function usuarioAtivoNaFuncao(role: string) {
  const candidatos = await prisma.user.findMany({
    where: {
      active: true,
      OR: [{ role }, { additionalRoles: { contains: role } }],
    },
    orderBy: { updatedAt: "desc" },
  });
  return candidatos.find((u) => effectiveRoles(u).includes(role)) ?? null;
}
