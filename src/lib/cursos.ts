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
