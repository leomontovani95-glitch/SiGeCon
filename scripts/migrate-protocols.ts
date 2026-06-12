/**
 * Migração: remove o ano do número de protocolo.
 * De: "CPI - 2026 - 0001 - CFSd 2025"
 * Para: "CPI - 0001 - CFSd 2025"
 *
 * Executar uma única vez: npx tsx scripts/migrate-protocols.ts
 */
import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import path from "path";

const dbPath = path.resolve(process.cwd(), "dev.db").replace(/\\/g, "/");
const prisma = new PrismaClient({ adapter: new PrismaLibSql({ url: `file:///${dbPath}` }) });

async function main() {
  const comms = await prisma.communication.findMany({
    select: { id: true, protocolNumber: true },
  });

  let migrated = 0;
  for (const c of comms) {
    const partes = c.protocolNumber.split(" - ");
    // Formato legado tem 4 partes: ["CPI", "2026", "0001", "CFSd 2025"]
    if (partes.length >= 4 && /^\d{4}$/.test(partes[1])) {
      const novo = [partes[0], ...partes.slice(2)].join(" - ");
      await prisma.communication.update({
        where: { id: c.id },
        data: { protocolNumber: novo },
      });
      console.log(`  ${c.protocolNumber}  →  ${novo}`);
      migrated++;
    }
  }

  console.log(`\nMigração concluída: ${migrated} protocolo(s) atualizado(s).`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
