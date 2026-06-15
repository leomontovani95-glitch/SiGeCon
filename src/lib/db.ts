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
