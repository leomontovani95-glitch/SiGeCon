export function abreviarPelotao(nome: string | null | undefined): string {
  if (!nome) return "—";
  return nome.replace(/Pelotão/gi, "Pel");
}

export function platoonOrder(nome: string | null | undefined): number {
  if (!nome) return 999;
  const m = nome.match(/\d+/);
  return m ? parseInt(m[0], 10) : 999;
}

// Exibe o número de curso com no mínimo dois dígitos: "1" -> "01", "10" -> "10",
// "1-R" -> "01-R". Preserva sufixos (ex.: "-R" de aluno remanescente).
export function formatCourseNumber(n: string | null | undefined): string {
  if (n === null || n === undefined || String(n).trim() === "") return "—";
  const m = String(n).trim().match(/^(\d+)(.*)$/);
  if (!m) return String(n).trim();
  return m[1].padStart(2, "0") + m[2];
}

// Formata o RG no padrão de exibição da PMES: XX.XXX-X (último dígito é o
// verificador, após o hífen; os demais agrupados em milhares). Aceita entrada
// só com números (231936 → 23.193-6) ou já formatada (idempotente). Tolera RGs
// com mais dígitos sem perder informação (agrupa à esquerda).
export function maskRG(value: string | null | undefined): string {
  const d = (value ?? "").replace(/\D/g, "").slice(0, 9);
  if (d.length <= 1) return d;
  const check = d.slice(-1);
  const body = d.slice(0, -1).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${body}-${check}`;
}

// Rótulo do caderno disciplinar: "CD Nº 01/2026 — CURSO". A numeração reinicia
// a cada ano, por isso o ano (de criação) faz parte da identificação.
export function formatCadernoNumero(
  book: { number: number; year: number; course?: { name: string } | null },
): string {
  const n = String(book.number).padStart(2, "0");
  return book.course
    ? `CD Nº ${n}/${book.year} — ${book.course.name}`
    : `CD-${n}/${book.year}`;
}

// Linha da escola para o cabeçalho dos PDFs. Quando não há escola definida
// (ex.: relatório/ranking de todos os cursos), usa "DIVISÃO ACADÊMICA".
export function escolaHeaderLabel(school: string | null | undefined): string {
  if (school === "ESFO") return "ESCOLA DE FORMAÇÃO DE OFICIAIS - EsFO";
  if (school === "ESFAP") return "ESCOLA DE FORMAÇÃO E APERFEIÇOAMENTO DE PRAÇAS - EsFAP";
  return "DIVISÃO ACADÊMICA";
}

// Data LOCAL no formato YYYY-MM-DD. Evita o deslize de dia que ocorre com
// new Date().toISOString() (que usa UTC) perto da meia-noite no Brasil (UTC-3).
export function dataLocalISO(d: Date = new Date()): string {
  const ano = d.getFullYear();
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}
