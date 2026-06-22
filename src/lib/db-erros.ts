import { Prisma } from "@prisma/client";

// Detectores de erro do banco usados pelos wrappers de retry (protocolo/caderno).
// Módulo puro (sem prisma client / sem "server-only") para ser testável.

// Colisão de constraint @unique — ex.: número de protocolo/caderno gerado
// concorrentemente para o mesmo curso. Recalcular e repetir resolve.
export function isUniqueViolation(e: unknown): boolean {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
}

// "Banco ocupado" (lock de escrita do SQLite/libsql). Como o erro pode chegar
// embrulhado pelo Prisma de formas diferentes, varremos a mensagem e a cadeia de
// causas por sinais conhecidos. Repetir com uma pequena espera resolve.
export function isBancoOcupado(e: unknown): boolean {
  const sinais = [
    "database is locked",
    "database table is locked",
    "database is busy",
    "sqlite_busy",
  ];
  const visto = new Set<unknown>();
  let atual: unknown = e;
  while (atual && !visto.has(atual)) {
    visto.add(atual);
    const msg = (atual instanceof Error ? atual.message : String(atual)).toLowerCase();
    if (sinais.some((s) => msg.includes(s))) return true;
    atual = atual instanceof Error ? atual.cause : undefined;
  }
  return false;
}
