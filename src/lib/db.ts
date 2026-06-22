import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import path from "path";

// Caminho absoluto do arquivo SQLite, derivado do DATABASE_URL. null se o banco
// não for um arquivo local (ex.: URL remota). Fonte única usada pelo cliente
// Prisma e pelo backup, evitando caminho fixo divergente.
export function dbFilePath(): string | null {
  const rawUrl = process.env.DATABASE_URL ?? "";
  if (!rawUrl.startsWith("file:")) return null;
  const filePath = rawUrl.replace("file:", "").replace("./", "");
  return path.resolve(process.cwd(), filePath);
}

function createPrismaClient() {
  const rawUrl = process.env.DATABASE_URL ?? "";
  const file = dbFilePath();
  const url = file ? `file:///${file.replace(/\\/g, "/")}` : rawUrl;
  const adapter = new PrismaLibSql({ url });
  return new PrismaClient({ adapter });
}

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };
export const prisma = globalForPrisma.prisma || createPrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

// PRAGMAs recomendados para uso concorrente do SQLite local. Chamado uma vez no
// boot (instrumentation.ts). Só faz sentido para banco em arquivo (file:).
//
// - journal_mode=WAL: leitores deixam de bloquear o escritor (e vice-versa) —
//   elimina a maior parte dos erros "database is locked" num app com várias
//   pessoas ao mesmo tempo. É PERSISTENTE no arquivo do banco: aplicado uma vez,
//   toda conexão futura (inclusive após reinício do servidor) já abre em WAL.
//
// - busy_timeout=5000: a conexão espera até 5s pela vez em vez de falhar na hora.
//   ATENÇÃO: o adaptador libSQL recria a conexão a cada transação interativa SEM
//   reaplicar este valor (verificado), então o busy_timeout é best-effort — vale
//   para as conexões que não passam por transação interativa. Os caminhos de
//   escrita concorrente mais quentes (protocolo/caderno) já têm retry explícito
//   (comTransacaoRetry em lib/caderno.ts), que cobre o caso writer×writer.
export async function aplicarPragmasSQLite(): Promise<void> {
  if (!dbFilePath()) return;
  await prisma.$queryRawUnsafe("PRAGMA journal_mode=WAL");
  await prisma.$queryRawUnsafe("PRAGMA busy_timeout=5000");
}
