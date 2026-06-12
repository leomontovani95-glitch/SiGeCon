export function abreviarPelotao(nome: string | null | undefined): string {
  if (!nome) return "—";
  return nome.replace(/Pelotão/gi, "Pel");
}

export function platoonOrder(nome: string | null | undefined): number {
  if (!nome) return 999;
  const m = nome.match(/\d+/);
  return m ? parseInt(m[0], 10) : 999;
}
