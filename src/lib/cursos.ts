// Lógica compartilhada de cursos: opções por escola, geração da sigla e
// derivação do nome por extenso. Sem "server-only" — usado tanto no formulário
// (client) quanto na server action, para a sigla ser idêntica nos dois lados.

export type EscolaCurso = "ESFO" | "ESFAP";
export type BaseCurso = "CFO" | "CHS" | "CFSd";

// Cursos base disponíveis em cada escola.
export const CURSOS_POR_ESCOLA: Record<EscolaCurso, { value: BaseCurso; label: string }[]> = {
  ESFO: [{ value: "CFO", label: "Curso de Formação de Oficiais (CFO)" }],
  ESFAP: [
    { value: "CHS", label: "Curso de Habilitação de Sargentos (CHS)" },
    { value: "CFSd", label: "Curso de Formação de Soldados (CFSd)" },
  ],
};

export const ANOS_LETIVOS = [1, 2, 3] as const;

// Gera a sigla (campo `name`) a partir dos dados estruturados.
// EsFO/CFO: "CFO {ano letivo}". EsFAP (CHS/CFSd): "{base} {ano de início}".
// Remanescente acrescenta " - Remanescente".
export function gerarSiglaCurso(opts: {
  baseCourse: BaseCurso;
  academicYear?: number | null;
  startYear?: number | null;
  remnant?: boolean;
}): string {
  const { baseCourse, academicYear, startYear, remnant } = opts;
  const base =
    baseCourse === "CFO"
      ? `CFO ${academicYear ?? ""}`.trim()
      : `${baseCourse} ${startYear ?? ""}`.trim();
  return remnant ? `${base} - Remanescente` : base;
}

// Nome por extenso (parte descritiva, sem a sigla nem o "- Remanescente"),
// derivado da sigla. Ex.: "CFO 2" -> "Curso de Formação de Oficiais 2º Ano".
export function nomeExtensoCurso(name: string | null | undefined): string {
  if (!name) return "—";
  const up = name.toUpperCase().trim();
  if (up.startsWith("CFO")) {
    const m = up.match(/\d/);
    return `Curso de Formação de Oficiais${m ? ` ${m[0]}º Ano` : ""}`;
  }
  if (up.startsWith("CFSD")) return "Curso de Formação de Soldados";
  if (up.startsWith("CHS")) return "Curso de Habilitação de Sargentos";
  return name;
}

// Reconstrói os campos estruturados a partir de um curso já salvo, para
// pré-preencher o formulário de edição (identidade exibida como leitura).
export function parseCursoParaForm(course: {
  name: string;
  school?: string | null;
  year?: number | null;
}): {
  school: string;
  baseCourse: string;
  academicYear: string;
  startYear: string;
  remnant: string;
} {
  const up = course.name.toUpperCase();
  const baseCourse = up.startsWith("CFO") ? "CFO" : up.startsWith("CFSD") ? "CFSd" : up.startsWith("CHS") ? "CHS" : "";
  const anoMatch = baseCourse === "CFO" ? course.name.match(/\d/) : null;
  return {
    school: course.school ?? "",
    baseCourse,
    academicYear: anoMatch ? anoMatch[0] : "",
    startYear: course.year != null ? String(course.year) : "",
    remnant: /remanescente/i.test(course.name) ? "true" : "false",
  };
}

// ── Filtro de situação do curso (ativos/inativos) ────────────────────────────
// Usado pelas abas de busca para que o staff possa, opcionalmente, ver os dados
// de cursos inativados. Padrão: somente ativos (espelha a contagem do painel).
export type SituacaoCurso = "ativos" | "inativos" | "todos";

export const SITUACAO_CURSO_OPTS: { key: SituacaoCurso; label: string }[] = [
  { key: "ativos", label: "Ativos" },
  { key: "inativos", label: "Inativos" },
  { key: "todos", label: "Todos" },
];

export function normalizeSituacaoCurso(v?: string): SituacaoCurso {
  return v === "inativos" || v === "todos" ? v : "ativos";
}

// Fragmento Prisma para filtrar `course.active` conforme a situação escolhida.
// "todos" não filtra; "ativos"/"inativos" travam o booleano.
export function activeWhereCurso(s: SituacaoCurso): { active?: boolean } {
  if (s === "ativos") return { active: true };
  if (s === "inativos") return { active: false };
  return {};
}

// Fragmento de escopo de curso para queries de Communication/DisciplinaryBook.
// Curso específico (cursoId) tem precedência; senão filtra pela relação `course`
// combinando escola do usuário + situação. "todos" sem escola → sem filtro.
export function courseScopeWhere(
  s: SituacaoCurso,
  school: string | null,
  cursoId?: string,
): Record<string, unknown> {
  if (cursoId) return { courseId: cursoId };
  const scope = { ...(school ? { school } : {}), ...activeWhereCurso(s) };
  return Object.keys(scope).length ? { course: scope } : {};
}

// Fragmento de status do aluno conforme a situação do curso: alunos de cursos
// inativos ficam INATIVO. "todos" não filtra por status.
export function studentStatusWhere(s: SituacaoCurso): { status?: "ATIVO" | "INATIVO" } {
  if (s === "ativos") return { status: "ATIVO" };
  if (s === "inativos") return { status: "INATIVO" };
  return {};
}

// Monta as opções do seletor de situação (SituacaoCursoFilter). `hrefFor` é
// fornecido por cada página, que sabe quais filtros preservar no link.
export function buildSituacaoOptions(
  situacao: SituacaoCurso,
  hrefFor: (key: SituacaoCurso) => string,
): { key: SituacaoCurso; label: string; href: string; active: boolean }[] {
  return SITUACAO_CURSO_OPTS.map((o) => ({
    key: o.key,
    label: o.label,
    href: hrefFor(o.key),
    active: situacao === o.key,
  }));
}
