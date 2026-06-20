// Política pura de papéis/permissões/escola. SEM "server-only", Prisma ou
// next — para poder ser testada isoladamente e reutilizada no servidor.

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

// Acesso à aba "Manual do Aluno" (gerir dispositivos legais)
export const MANUAL_ROLES: UserRole[] = [
  "ADMINISTRADOR", "CHEFE_DIVISAO_ACADEMICA",
  "COMANDANTE_ESFO", "SUBCOMANDANTE_ESFO",
  "COMANDANTE_ESFAP", "SUBCOMANDANTE_ESFAP",
];

// Acesso de consulta geral: veem despachos mas não agem
export const VIEWERS_APM: UserRole[] = ["COMANDANTE_APM", "SUBCOMANDANTE_APM"];

export const PARECERISTAS: UserRole[] = [
  "SUBCOMANDANTE_ESFAP", "SUBCOMANDANTE_ESFO", "OFICIAL_ESFAP", "OFICIAL_ESFO",
];

// ── Gestão de caderno disciplinar ────────────────────────────────────────
// Quem pode Revisar/Publicar caderno, gerar/editar AACP e adicionar/remover
// registros: do Oficial ao Comandante de cada escola, mais Administração e
// Chefe da Divisão Acadêmica. (NÃO inclui Protocolo, Chefe de Curso, etc.)
export const CADERNO_MANAGERS: UserRole[] = [
  "ADMINISTRADOR", "CHEFE_DIVISAO_ACADEMICA",
  "COMANDANTE_ESFAP", "COMANDANTE_ESFO",
  "SUBCOMANDANTE_ESFAP", "SUBCOMANDANTE_ESFO",
  "OFICIAL_ESFAP", "OFICIAL_ESFO",
];

export function canManageCaderno(role: string, additionalRoles?: string) {
  const all = effectiveRoles({ role, additionalRoles });
  return all.some((r) => (CADERNO_MANAGERS as string[]).includes(r));
}

// Alterar a decisão de uma comunicação dentro de um caderno rascunho é
// exclusivo dos Comandantes de Escola (respeitando a escola do caderno) e da
// Administração. O escopo de escola é checado à parte com escolaNoEscopo().
export const BOOK_DECISION_CHANGERS: UserRole[] = [
  "ADMINISTRADOR", "COMANDANTE_ESFAP", "COMANDANTE_ESFO",
];

export function canChangeBookDecision(role: string, additionalRoles?: string) {
  const all = effectiveRoles({ role, additionalRoles });
  return all.some((r) => (BOOK_DECISION_CHANGERS as string[]).includes(r));
}

// Retorna todos os roles efetivos de uma session (primário + adicionais)
export function effectiveRoles(session: { role: string; additionalRoles?: string }): string[] {
  const extras = (session.additionalRoles ?? "").split(",").map((r) => r.trim()).filter(Boolean);
  return [session.role, ...extras];
}

export function canEmitOpinion(role: string, additionalRoles?: string) {
  const all = effectiveRoles({ role, additionalRoles });
  return all.some((r) => (PARECERISTAS as string[]).includes(r));
}

export function canDecide(role: string, additionalRoles?: string) {
  const all = effectiveRoles({ role, additionalRoles });
  return all.some((r) => (COMANDANTES as string[]).includes(r));
}

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

// ── CPI / Ref. Elogiosa entre alunos da EsFO ─────────────────────────────

// Hierarquia de cursos EsFO (valor maior = posto mais elevado)
export const ESFO_CFO_RANK: Record<string, number> = {
  "CFO 3": 3,
  "CFO 2": 2,
  "CFO 1": 1,
};

// Retorna os IDs dos cursos que o aluno pode comunicar, com base no seu curso
export function cursosPermitidosParaCPI(
  studentCourseName: string,
  allCourses: { id: string; name: string; school: string | null }[]
): string[] {
  const myRank = ESFO_CFO_RANK[studentCourseName];
  if (myRank === undefined) return [];
  return allCourses
    .filter((c) => {
      if (c.school === "ESFAP") return true;
      if (c.school === "ESFO") {
        const targetRank = ESFO_CFO_RANK[c.name];
        return targetRank !== undefined && targetRank < myRank;
      }
      return false;
    })
    .map((c) => c.id);
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

// True se a escola da comunicação (course.school) está dentro do escopo do
// usuário. Escopo nulo (ADMIN/Div.Acadêmica/APM/global) acessa qualquer escola.
export function escolaNoEscopo(
  session: { role: string; escola?: string | null },
  schoolDaComunicacao?: string | null,
): boolean {
  const escopo = getSchoolFilter(session.role, session.escola);
  return !escopo || schoolDaComunicacao === escopo;
}
