// Status que têm pontuação aplicada — usados para filtrar comunicações antes de calcular a nota
export const STATUS_COM_PONTUACAO = [
  "PUBLICADA_CADERNO",
  "FINALIZADA",
] as const;

export function calcularNota(
  comunicacoesDecididas: Array<{
    finalScore: number | null;
    type: { scoreNature: string };
  }>
): number {
  let nota = 10;
  for (const c of comunicacoesDecididas) {
    if (c.finalScore == null) continue;
    if (c.type.scoreNature === "DESFAVORAVEL") {
      nota -= c.finalScore;
    } else {
      nota += c.finalScore;
    }
  }
  return Math.round(nota * 100) / 100;
}

export function faixaNota(nota: number): {
  cor: string;
  tailwind: string;
  label: string;
} {
  if (nota >= 9)
    return { cor: "verde-escuro", tailwind: "bg-green-800 text-white", label: "Excelente" };
  if (nota >= 8)
    return { cor: "verde-claro", tailwind: "bg-green-500 text-white", label: "Bom" };
  if (nota >= 7)
    return { cor: "amarelo", tailwind: "bg-yellow-400 text-black", label: "Regular" };
  if (nota >= 6)
    return { cor: "vermelho-claro", tailwind: "bg-red-400 text-white", label: "Atenção" };
  return { cor: "vermelho-escuro", tailwind: "bg-red-700 text-white", label: "Reprovado" };
}

export function zonaDeRisco(nota: number): boolean {
  return nota < 7;
}
