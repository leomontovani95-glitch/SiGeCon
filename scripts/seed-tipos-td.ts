import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import path from "path";
const dbPath = path.resolve(process.cwd(), "dev.db").replace(/\\/g, "/");
const prisma = new PrismaClient({ adapter: new PrismaLibSql({ url: `file:///${dbPath}` }) });
const tipos = [
  { name: "TD Leve",  description: "Transgressão Disciplinar Leve — 1,0 ponto",   score: 1.0, scoreNature: "DESFAVORAVEL" },
  { name: "TD Média", description: "Transgressão Disciplinar Média — 2,0 pontos",  score: 2.0, scoreNature: "DESFAVORAVEL" },
  { name: "TD Grave", description: "Transgressão Disciplinar Grave — 3,0 pontos",  score: 3.0, scoreNature: "DESFAVORAVEL" },
  { name: "TAC",      description: "Termo de Ajuste de Conduta",                   score: 0.0, scoreNature: "DESFAVORAVEL" },
];
async function main() {
  for (const t of tipos) {
    const r = await prisma.communicationType.upsert({ where: { name: t.name }, update: {}, create: { ...t, active: true } });
    console.log("OK:", r.name, r.id);
  }
}
main().catch(console.error).finally(() => prisma.$disconnect());
