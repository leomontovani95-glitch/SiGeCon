export function abreviarPelotao(nome: string | null | undefined): string {
  if (!nome) return "—";
  return nome.replace(/Pelotão/gi, "Pel");
}

export function platoonOrder(nome: string | null | undefined): number {
  if (!nome) return 999;
  const m = nome.match(/\d+/);
  return m ? parseInt(m[0], 10) : 999;
}

// Data LOCAL no formato YYYY-MM-DD. Evita o deslize de dia que ocorre com
// new Date().toISOString() (que usa UTC) perto da meia-noite no Brasil (UTC-3).
export function dataLocalISO(d: Date = new Date()): string {
  const ano = d.getFullYear();
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}
