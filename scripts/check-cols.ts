import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import path from "path";

const dbPath = path.resolve(process.cwd(), "dev.db").replace(/\\/g, "/");
const prisma = new PrismaClient({ adapter: new PrismaLibSql({ url: `file:///${dbPath}` }) });

async function main() {
  const result = await prisma.$queryRawUnsafe("PRAGMA table_info(Communication)") as any[];
  console.log("Colunas da tabela Communication:");
  result.forEach((r: any) => console.log(" -", r.name));
}

main().catch(console.error).finally(() => prisma.$disconnect());
