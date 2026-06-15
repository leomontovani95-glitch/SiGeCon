// Feriados de DIA FIXO (mesmo dia/mês todo ano): nacionais + estadual do ES.
// Por decisão de política, NÃO incluímos feriados móveis (Carnaval, Sexta-feira
// Santa, Corpus Christi). Como todos têm data fixa, valem para qualquer ano.
const FERIADOS_FIXOS = new Set<string>([
  "01-01", // Confraternização Universal
  "04-21", // Tiradentes
  "05-01", // Dia do Trabalho
  "05-23", // Colonização do Solo Espírito-santense (feriado estadual do ES)
  "09-07", // Independência do Brasil
  "10-12", // Nossa Senhora Aparecida
  "11-02", // Finados
  "11-15", // Proclamação da República
  "11-20", // Consciência Negra
  "12-25", // Natal
]);

// True se a data (no fuso local) é um feriado fixo. O fuso do servidor é fixado
// em America/Sao_Paulo (ver instrumentation.ts), então getMonth/getDate são BRT.
export function ehFeriado(data: Date): boolean {
  const mm = String(data.getMonth() + 1).padStart(2, "0");
  const dd = String(data.getDate()).padStart(2, "0");
  return FERIADOS_FIXOS.has(`${mm}-${dd}`);
}
