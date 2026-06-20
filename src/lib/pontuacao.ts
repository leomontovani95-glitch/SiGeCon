// Pontuação reduzida de CPI 1 ─────────────────────────────────────────────
// O Art. 146, I (alíneas "a" e "b" — uniforme em desalinho / calçado sem
// brilho) é enquadrado como CPI 1, porém vale METADE da pontuação: 0,1 em vez
// de 0,2. Esta é a fonte única usada tanto no formulário (nota explicativa na
// pontuação sugerida) quanto no caderno PDF (observação "50% da pont. de CPI 1").

export const OBS_CPI1_METADE = "50% da pont. de CPI 1";

/**
 * Indica se o enquadramento corresponde a uma CPI 1 que vale 50% da pontuação
 * (Art. 146, Inciso I — alíneas "a"/"b").
 */
export function ehCpi1Metade(
  article: string | null | undefined,
  item: string | null | undefined,
): boolean {
  return article === "146" && item === "I";
}

/**
 * Pontuação automática (módulo) de uma comunicação: vem do score cadastrado em
 * "Tipos de Comunicação" (CommunicationType.score), com a exceção do Art. 146, I
 * (a/b), que vale metade. O sinal (descontar/somar) é definido pelo scoreNature
 * do tipo no cálculo da nota — aqui retornamos sempre o módulo positivo.
 *
 * Ao alterar o score na aba Tipos de Comunicação, novas comunicações passam a
 * usar o novo valor automaticamente.
 */
export function pontuacaoAutomatica(
  typeScore: number,
  article: string | null | undefined,
  item: string | null | undefined,
): number {
  const base = ehCpi1Metade(article, item) ? typeScore / 2 : typeScore;
  // Evita ruído de ponto flutuante (ex.: 0.30000000000000004).
  return Math.round(base * 100) / 100;
}
