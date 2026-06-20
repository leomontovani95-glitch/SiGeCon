// Pontuação reduzida de CPI 1 ─────────────────────────────────────────────
// Alguns dispositivos são enquadrados como CPI 1, porém valem METADE da
// pontuação (50%). Historicamente isso valia para o Art. 146, I (alíneas "a"/"b"
// — uniforme em desalinho / calçado sem brilho), mas agora é CONFIGURÁVEL por
// dispositivo (ManualRule.halfCpi1) e fica gravado como snapshot na comunicação
// (Communication.halfCpi1). Assim, se a legislação mudar qual artigo vale metade,
// basta marcar/desmarcar no Manual do Aluno, sem alterar código.
//
// Esta é a fonte única do texto usado no caderno PDF (observação
// "50% da pont. de CPI 1") e na nota explicativa dos formulários.

export const OBS_CPI1_METADE = "50% da pont. de CPI 1";

/**
 * Pontuação automática (módulo) de uma comunicação: vem do score cadastrado em
 * "Tipos de Comunicação" (CommunicationType.score), com a exceção dos
 * dispositivos marcados como "50% da CPI 1" (halfCpi1), que valem metade. O sinal
 * (descontar/somar) é definido pelo scoreNature do tipo no cálculo da nota — aqui
 * retornamos sempre o módulo positivo.
 *
 * Ao alterar o score na aba Tipos de Comunicação, novas comunicações passam a
 * usar o novo valor automaticamente (a metade acompanha).
 */
export function pontuacaoAutomatica(typeScore: number, halfCpi1: boolean): number {
  const base = halfCpi1 ? typeScore / 2 : typeScore;
  // Evita ruído de ponto flutuante (ex.: 0.30000000000000004).
  return Math.round(base * 100) / 100;
}
