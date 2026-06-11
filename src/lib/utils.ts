export function abreviarPelotao(nome: string | null | undefined): string {
  if (!nome) return "—";
  return nome.replace(/Pelotão/gi, "Pel");
}
