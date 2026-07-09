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
  "COMANDANTE_ESFO", "SUBCOMANDANTE_ESFO", "OFICIAL_ESFO",
  "COMANDANTE_ESFAP", "SUBCOMANDANTE_ESFAP", "OFICIAL_ESFAP",
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

// ── Observações no histórico do aluno ────────────────────────────────────
// Registro interno de fatos relevantes que NÃO geram comunicação (positivos ou
// negativos). Acesso do Oficial de cada escola para cima, mais Cmt/Subcmt APM
// (topo da hierarquia), Chefe da Divisão Acadêmica e Administrador. NÃO inclui
// Chefe de Curso nem Protocolo. Consulta/edição também respeitam o escopo de
// escola do aluno (escolaNoEscopo), tratado nas telas/rotas.
export const OBSERVACAO_ROLES: UserRole[] = [
  "ADMINISTRADOR", "CHEFE_DIVISAO_ACADEMICA",
  "COMANDANTE_APM", "SUBCOMANDANTE_APM",
  "COMANDANTE_ESFO", "SUBCOMANDANTE_ESFO", "OFICIAL_ESFO",
  "COMANDANTE_ESFAP", "SUBCOMANDANTE_ESFAP", "OFICIAL_ESFAP",
];

export function canManageObservacoes(role: string, additionalRoles?: string) {
  const all = effectiveRoles({ role, additionalRoles });
  return all.some((r) => (OBSERVACAO_ROLES as string[]).includes(r));
}

// Editar uma observação: por regra só o AUTOR edita a própria observação. O
// Administrador é exceção (acumula todas as atribuições) e pode editar qualquer
// uma. A exclusão não é permitida a ninguém (registro permanente do histórico).
export function podeEditarObservacao(
  session: { userId: string; role: string; additionalRoles?: string },
  observacao: { authorId: string },
): boolean {
  if (session.userId === observacao.authorId) return true;
  return effectiveRoles(session).includes("ADMINISTRADOR");
}

// Retorna todos os roles efetivos de uma session (primário + adicionais)
export function effectiveRoles(session: { role: string; additionalRoles?: string }): string[] {
  const extras = (session.additionalRoles ?? "").split(",").map((r) => r.trim()).filter(Boolean);
  return [session.role, ...extras];
}

export function canEmitOpinion(role: string, additionalRoles?: string) {
  const all = effectiveRoles({ role, additionalRoles });
  // O Administrador acumula todas as atribuições e também pode emitir parecer.
  // Mantido fora da lista PARECERISTAS de propósito: essa lista governa os
  // badges/filas do painel (layout.tsx), onde o admin tem fila própria.
  return all.some((r) => r === "ADMINISTRADOR" || (PARECERISTAS as string[]).includes(r));
}

export function canDecide(role: string, additionalRoles?: string) {
  const all = effectiveRoles({ role, additionalRoles });
  return all.some((r) => (COMANDANTES as string[]).includes(r));
}

// Decisão de CPI: por padrão decide o Comandante da Escola (da sua escola). Ao se
// julgar impedido, ele encaminha a CPI ao Chefe da Divisão Acadêmica, e SÓ nesse
// caso o Chefe profere a decisão. ADMINISTRADOR acumula os dois papéis.
export const COMMANDER_DECIDERS: UserRole[] = [
  "ADMINISTRADOR", "COMANDANTE_ESFAP", "COMANDANTE_ESFO",
];
export const DIVISION_DECIDERS: UserRole[] = [
  "ADMINISTRADOR", "CHEFE_DIVISAO_ACADEMICA",
];

// Decide os casos comuns (status AGUARDANDO_DECISAO) e pode encaminhar à Divisão.
export function canDecideAsCommander(role: string, additionalRoles?: string) {
  const all = effectiveRoles({ role, additionalRoles });
  return all.some((r) => (COMMANDER_DECIDERS as string[]).includes(r));
}

// Decide apenas as CPIs encaminhadas pela Escola (status AGUARDANDO_DECISAO_DIVISAO).
export function canDecideAsDivision(role: string, additionalRoles?: string) {
  const all = effectiveRoles({ role, additionalRoles });
  return all.some((r) => (DIVISION_DECIDERS as string[]).includes(r));
}

export function canRegisterCommunication(role: string) {
  return role !== "ALUNO";
}

// Perfis de apoio que apenas acompanham o ANDAMENTO (histórico de tramitação)
// das comunicações, sem acesso ao conteúdo sensível — defesa/justificativa do
// aluno, parecer e decisão. Mantém maior controle e evita a divulgação de
// informações sensíveis do processo. O aluno comunicante segue a mesma lógica
// (tratada à parte na tela, pois depende do vínculo com a comunicação).
export const RESTRICTED_COMM_VIEW_ROLES: UserRole[] = ["CHEFE_CURSO", "PROTOCOLO"];

export function temVistaRestritaComunicacao(role: string): boolean {
  return (RESTRICTED_COMM_VIEW_ROLES as string[]).includes(role);
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

// ── Atribuição de escola ao criar/editar usuário ─────────────────────────────
// Apenas Comandante de Escola para cima (nível de ator <= 2: COMANDANTE_ESFAP/
// ESFO, CHEFE_DIVISAO_ACADEMICA, ADMINISTRADOR) pode trocar a escola livremente
// ou atribuir "TODAS". Subcomandante, Oficial e Chefe de Curso ficam restritos
// à própria escola. NÃO altera getSchoolFilter (que governa a VISIBILIDADE de
// dados); aqui o que importa é o que cada ator pode ATRIBUIR.
export function canAssignAnySchool(actorRole: string): boolean {
  const level = USER_ACTOR_LEVEL[actorRole as UserRole];
  return level !== undefined && level <= 2;
}

// Escolas que o ator pode atribuir a um usuário no formulário. Comandante para
// cima vê todas; os demais ficam restritos à própria escola (escopo de papel).
export function assignableSchools(actorRole: string, actorEscola?: string | null): string[] {
  if (canAssignAnySchool(actorRole)) return ["TODAS", "ESFAP", "ESFO"];
  const escopo = getSchoolFilter(actorRole, actorEscola);
  return escopo ? [escopo] : ["TODAS", "ESFAP", "ESFO"];
}

// Pode gerir (editar/excluir/resetar senha) ESTE usuário específico: precisa
// poder gerir a função (nível) E respeitar a escola. Usuário vinculado a uma
// escola não age sobre usuários de outra escola; só Comandante de Escola para
// cima (canAssignAnySchool) atua em qualquer escola. Ex.: Oficial da EsFO não
// edita Chefe de Curso/Protocolo vinculado à EsFAP.
export function canManageUserScoped(
  actor: { role: string; escola?: string | null },
  target: { role: string; escola?: string | null },
): boolean {
  if (!canManageUserRole(actor.role, target.role)) return false;
  if (canAssignAnySchool(actor.role)) return true;
  const escopo = getSchoolFilter(actor.role, actor.escola);
  if (!escopo) return true; // ator sem escopo de escola definido
  return target.escola === escopo;
}

// ── Ordem de exibição na lista de usuários ───────────────────────────────────
// Do maior "poder" para o menor. Usado para ordenar a aba Usuários.
export const USER_DISPLAY_ORDER: Record<string, number> = {
  ADMINISTRADOR:           0,
  COMANDANTE_APM:          1,
  SUBCOMANDANTE_APM:       2,
  CHEFE_DIVISAO_ACADEMICA: 3,
  COMANDANTE_ESFAP:        4,
  COMANDANTE_ESFO:         5,
  SUBCOMANDANTE_ESFAP:     6,
  SUBCOMANDANTE_ESFO:      7,
  OFICIAL_ESFAP:           8,
  OFICIAL_ESFO:            9,
  CHEFE_CURSO:             10,
  PROTOCOLO:               11,
};

// Desempate por escola dentro da mesma função: EsFO tem preferência (ex.: Chefe
// de Curso da EsFO aparece antes do da EsFAP); "Todas"/sem escola por último.
function escolaOrdemExibicao(escola?: string | null): number {
  if (escola === "ESFO") return 0;
  if (escola === "ESFAP") return 1;
  return 2;
}

// Comparador: função (poder) → escola (EsFO primeiro) → nome. Ordena pelo papel
// PRIMÁRIO, então o Administrador vem primeiro mesmo acumulando outras funções.
export function compareUsersForDisplay(
  a: { role: string; escola?: string | null; fullName: string },
  b: { role: string; escola?: string | null; fullName: string },
): number {
  const ra = USER_DISPLAY_ORDER[a.role] ?? 99;
  const rb = USER_DISPLAY_ORDER[b.role] ?? 99;
  if (ra !== rb) return ra - rb;
  const sa = escolaOrdemExibicao(a.escola);
  const sb = escolaOrdemExibicao(b.escola);
  if (sa !== sb) return sa - sb;
  return a.fullName.localeCompare(b.fullName, "pt-BR");
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
