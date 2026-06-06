"server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";

export type UserRole =
  | "ADMINISTRADOR"
  | "COMANDANTE_APM"
  | "SUBCOMANDANTE_APM"
  | "COMANDANTE_ESFAP"
  | "COMANDANTE_ESFO"
  | "CHEFE_DIVISAO_ACADEMICA"
  | "SUBCOMANDANTE_ESFAP"
  | "SUBCOMANDANTE_ESFO"
  | "OFICIAL_ESFAP"
  | "OFICIAL_ESFO"
  | "CHEFE_CURSO"
  | "PROTOCOLO"
  | "ALUNO";

// Acesso irrestrito — passam em qualquer verifyRole automaticamente
export const SUPERUSERS: UserRole[] = ["ADMINISTRADOR", "CHEFE_DIVISAO_ACADEMICA"];

// Pode decidir e gerenciar cadernos
export const COMANDANTES: UserRole[] = [
  "ADMINISTRADOR", "COMANDANTE_ESFAP", "COMANDANTE_ESFO", "CHEFE_DIVISAO_ACADEMICA",
];

// Acesso de consulta geral: veem despachos mas não agem
export const VIEWERS_APM: UserRole[] = ["COMANDANTE_APM", "SUBCOMANDANTE_APM"];

export const PARECERISTAS: UserRole[] = [
  "SUBCOMANDANTE_ESFAP", "SUBCOMANDANTE_ESFO", "OFICIAL_ESFAP", "OFICIAL_ESFO",
];

// Retorna todos os roles efetivos de uma session (primário + adicionais)
export function effectiveRoles(session: { role: string; additionalRoles?: string }): string[] {
  const extras = (session.additionalRoles ?? "").split(",").map((r) => r.trim()).filter(Boolean);
  return [session.role, ...extras];
}

export const verifySession = cache(async () => {
  const session = await getSession();
  if (!session?.userId) redirect("/login");
  return session;
});

export const verifyRole = cache(async (...roles: UserRole[]) => {
  const session = await verifySession();
  const allRoles = effectiveRoles(session);
  const isSuperuser = allRoles.some((r) => (SUPERUSERS as string[]).includes(r));
  if (!isSuperuser && !allRoles.some((r) => roles.includes(r as UserRole))) redirect("/acesso-negado");
  return session;
});

export function canEmitOpinion(role: string, additionalRoles?: string) {
  const all = effectiveRoles({ role, additionalRoles });
  return all.some((r) => (PARECERISTAS as string[]).includes(r));
}

export function canDecide(role: string, additionalRoles?: string) {
  const all = effectiveRoles({ role, additionalRoles });
  return all.some((r) => (COMANDANTES as string[]).includes(r));
}

export const verifyStaff = cache(async () => {
  const session = await verifySession();
  if (session.role === "ALUNO") redirect("/acesso-negado");
  return session;
});

export function canRegisterCommunication(role: string) {
  return role !== "ALUNO";
}

export function canViewAllCommunications(role: string) {
  return [
    "ADMINISTRADOR",
    "COMANDANTE_ESFAP", "COMANDANTE_ESFO", "CHEFE_DIVISAO_ACADEMICA",
    "SUBCOMANDANTE_ESFAP", "SUBCOMANDANTE_ESFO", "OFICIAL_ESFAP", "OFICIAL_ESFO",
    "CHEFE_CURSO", "PROTOCOLO",
  ].includes(role);
}

export function getSchoolFilter(role: string, escolaUsuario?: string | null): string | null {
  // Role-based filters sempre têm precedência (COMANDANTE_ESFAP etc.)
  if (["COMANDANTE_ESFAP", "SUBCOMANDANTE_ESFAP", "OFICIAL_ESFAP"].includes(role)) return "ESFAP";
  if (["COMANDANTE_ESFO", "SUBCOMANDANTE_ESFO", "OFICIAL_ESFO"].includes(role)) return "ESFO";
  // Filtro configurado individualmente no cadastro do usuário
  if (escolaUsuario === "ESFAP") return "ESFAP";
  if (escolaUsuario === "ESFO") return "ESFO";
  return null;
}
