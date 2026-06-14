"server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { SUPERUSERS, effectiveRoles, type UserRole } from "@/lib/roles";

// Reexporta a política pura (papéis/permissões/escola) para os imports existentes
// continuarem usando "@/lib/dal". A implementação vive em @/lib/roles (testável).
export * from "@/lib/roles";

export const verifySession = cache(async () => {
  const session = await getSession();
  if (!session?.userId) redirect("/login");
  // Reconsulta o banco para que desativação/rebaixamento/troca de escola tenham
  // efeito imediato (não esperam o token de 8h expirar). cache() dedupa por request.
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { active: true, role: true, additionalRoles: true, escola: true, mustChangePassword: true },
  });
  if (!user || !user.active) redirect("/login");
  return {
    ...session,
    role: user.role,
    additionalRoles: user.additionalRoles,
    escola: user.escola,
    mustChangePassword: user.mustChangePassword,
  };
});

export const verifyRole = cache(async (...roles: UserRole[]) => {
  const session = await verifySession();
  const allRoles = effectiveRoles(session);
  const isSuperuser = allRoles.some((r) => (SUPERUSERS as string[]).includes(r));
  if (!isSuperuser && !allRoles.some((r) => roles.includes(r as UserRole))) redirect("/acesso-negado");
  return session;
});

export const verifyStaff = cache(async () => {
  const session = await verifySession();
  if (session.role === "ALUNO") redirect("/acesso-negado");
  return session;
});
