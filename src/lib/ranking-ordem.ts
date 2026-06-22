// Ordenação do Ranking de Conduta — compartilhada entre a tela (`/ranking`) e a
// impressão/PDF (`/ranking/imprimir`), para que o PDF respeite a mesma coluna e
// direção escolhidas nos cabeçalhos. Módulo puro (sem Prisma/server-only),
// testável.

export const ORDENS_RANKING = [
  "desc", "asc", // nota (maior→menor / menor→maior)
  "numAsc", "numDesc", // número do aluno
  "nomeAsc", "nomeDesc", // nome de guerra
  "cursoAsc", "cursoDesc", // curso
  "pelAsc", "pelDesc", // pelotão
  "classAsc", "classDesc", // classificação (faixa) — correlaciona com a nota
] as const;
export type OrdemRanking = (typeof ORDENS_RANKING)[number];

export const ORDEM_RANKING_PADRAO: OrdemRanking = "desc";

export function normalizarOrdemRanking(v: string | undefined): OrdemRanking {
  return (ORDENS_RANKING as readonly string[]).includes(v ?? "")
    ? (v as OrdemRanking)
    : ORDEM_RANKING_PADRAO;
}

export const ORDEM_RANKING_LABELS: Record<OrdemRanking, string> = {
  desc: "Nota (maior → menor)",
  asc: "Nota (menor → maior)",
  numAsc: "Número (crescente)",
  numDesc: "Número (decrescente)",
  nomeAsc: "Nome de Guerra (A → Z)",
  nomeDesc: "Nome de Guerra (Z → A)",
  cursoAsc: "Curso (A → Z)",
  cursoDesc: "Curso (Z → A)",
  pelAsc: "Pelotão (A → Z)",
  pelDesc: "Pelotão (Z → A)",
  classAsc: "Classificação (pior → melhor)",
  classDesc: "Classificação (melhor → pior)",
};

export type LinhaRanking = {
  warName: string;
  courseNumber: string;
  courseName: string;
  platoonName: string | null;
  nota: number;
};

// Comparador para Array.prototype.sort. Empates são desfeitos pelo número do
// aluno (crescente), deixando a ordem estável e previsível dentro de cada grupo
// (ex.: alunos do mesmo pelotão saem ordenados por número).
export function compararRanking(ordem: OrdemRanking) {
  // `numeric: true` faz a comparação tratar sequências de dígitos como números
  // (ordem natural): "2º Pel" antes de "10º Pel", "CFO 2" antes de "CFO 10" —
  // em vez da ordem alfabética pura, que colocaria "10" antes de "2".
  const opts: Intl.CollatorOptions = { numeric: true };
  return (a: LinhaRanking, b: LinhaRanking): number => {
    const num = (parseInt(a.courseNumber, 10) || 0) - (parseInt(b.courseNumber, 10) || 0);
    const nome = a.warName.localeCompare(b.warName, "pt-BR", opts);
    const curso = a.courseName.localeCompare(b.courseName, "pt-BR", opts);
    const pel = (a.platoonName ?? "").localeCompare(b.platoonName ?? "", "pt-BR", opts);
    const nota = a.nota - b.nota;
    switch (ordem) {
      case "asc": return nota || num;
      case "desc": return -nota || num;
      case "numAsc": return num;
      case "numDesc": return -num;
      case "nomeAsc": return nome || num;
      case "nomeDesc": return -nome || num;
      case "cursoAsc": return curso || num;
      case "cursoDesc": return -curso || num;
      case "pelAsc": return pel || num;
      case "pelDesc": return -pel || num;
      case "classAsc": return nota || num; // faixa correlaciona com a nota
      case "classDesc": return -nota || num;
      default: return -nota || num;
    }
  };
}
