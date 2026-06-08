import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import path from "path";

const dbPath = path.resolve(process.cwd(), "dev.db").replace(/\\/g, "/");
const prisma = new PrismaClient({ adapter: new PrismaLibSql({ url: `file:///${dbPath}` }) });

async function main() {
  const tipos = await prisma.communicationType.findMany({ orderBy: { name: "asc" } });
  tipos.forEach(t => console.log(t.name, "| score:", t.score, "| active:", t.active));
}

main().catch(console.error).finally(() => prisma.$disconnect());
