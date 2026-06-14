// Calcula a nota a partir de itens de cadernos PUBLICADOS.
// score positivo = favorável (RE, EBI), negativo = desfavorável (CPI).
// Alunos podem ultrapassar 10 com registros elogiosos.
export function calcularNotaPublicada(
  items: Array<{
    score: number | null;
    communication: { type: { scoreNature: string } };
  }>
): number {
  let nota = 10;
  for (const item of items) {
    if (item.score == null) continue;
    const magnitude = Math.abs(item.score);
    if (item.communication.type.scoreNature === "DESFAVORAVEL") {
      nota -= magnitude;
    } else {
      nota += magnitude;
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
