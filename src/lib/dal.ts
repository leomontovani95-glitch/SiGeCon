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

// ── Hierarquia de gestão de usuários ─────────────────────────────────────────

// Nível do ator (quem gerencia). Ausente = sem direito de gestão.
export const USER_ACTOR_LEVEL: Partial<Record<UserRole, number>> = {
  ADMINISTRADOR:           0,
  CHEFE_DIVISAO_ACADEMICA: 1,
  COMANDANTE_ESFAP:        2,
  COMANDANTE_ESFO:         2,
  SUBCOMANDANTE_ESFAP:     3,
  SUBCOMANDANTE_ESFO:      3,
  OFICIAL_ESFAP:           4,
  OFICIAL_ESFO:            4,
  CHEFE_CURSO:             5,
};

// Nível do alvo (qual função pode ser gerenciada). Ausente = não gerenciável pelos roles normais.
export const USER_TARGET_LEVEL: Partial<Record<UserRole, number>> = {
  ADMINISTRADOR:           0,
  CHEFE_DIVISAO_ACADEMICA: 1,
  COMANDANTE_APM:          1,
  SUBCOMANDANTE_APM:       1,
  COMANDANTE_ESFAP:        2,
  COMANDANTE_ESFO:         2,
  SUBCOMANDANTE_ESFAP:     3,
  SUBCOMANDANTE_ESFO:      3,
  OFICIAL_ESFAP:           4,
  OFICIAL_ESFO:            4,
  CHEFE_CURSO:             5,
  PROTOCOLO:               6,
};

// Retorna true se `actorRole` pode criar/editar um usuário com `targetRole`.
// Regra: actorLevel <= targetLevel (mesmo nível e abaixo).
export function canManageUserRole(actorRole: string, targetRole: string): boolean {
  const actorLevel = USER_ACTOR_LEVEL[actorRole as UserRole];
  const targetLevel = USER_TARGET_LEVEL[targetRole as UserRole];
  if (actorLevel === undefined || targetLevel === undefined) return false;
  return actorLevel <= targetLevel;
}

// Retorna as funções que o ator pode atribuir.
export function manageableRoles(actorRole: string): UserRole[] {
  return (Object.keys(USER_TARGET_LEVEL) as UserRole[]).filter((r) =>
    canManageUserRole(actorRole, r),
  );
}

// Roles com acesso à gestão de usuários (pelo menos uma função gerenciável).
export const USER_MANAGERS: UserRole[] = Object.keys(USER_ACTOR_LEVEL) as UserRole[];

export function getSchoolFilter(role: string, escolaUsuario?: string | null): string | null {
  // Role-based filters sempre têm precedência (COMANDANTE_ESFAP etc.)
  if (["COMANDANTE_ESFAP", "SUBCOMANDANTE_ESFAP", "OFICIAL_ESFAP"].includes(role)) return "ESFAP";
  if (["COMANDANTE_ESFO", "SUBCOMANDANTE_ESFO", "OFICIAL_ESFO"].includes(role)) return "ESFO";
  // Filtro configurado individualmente no cadastro do usuário
  if (escolaUsuario === "ESFAP") return "ESFAP";
  if (escolaUsuario === "ESFO") return "ESFO";
  return null;
}
