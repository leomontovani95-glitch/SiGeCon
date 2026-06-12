/**
 * Migração: corrige datas salvas como meia-noite UTC (bug de fuso horário).
 *
 * Causa: new Date("YYYY-MM-DD") interpreta a string como UTC 00:00:00.
 * No Brasil (UTC-3), isso equivale a 21h do dia anterior, fazendo todas as
 * datas aparecerem um dia antes do selecionado.
 *
 * Critério de seleção: registros cujo horário UTC é exatamente meia-noite
 * (T00:00:00.000Z). Datas criadas com new Date() / setHours(local) têm
 * componente de hora diferente de zero em UTC e NÃO são afetadas.
 *
 * Correção: adiciona 12 horas a cada data afetada, colocando-a ao meio-dia
 * local — equivalente a usar new Date("YYYY-MM-DD" + "T12:00:00") na gravação.
 *
 * Executar uma única vez: npx tsx scripts/fix-dates-utc.ts
 */
import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import path from "path";

const dbPath = path.resolve(process.cwd(), "dev.db").replace(/\\/g, "/");
const prisma = new PrismaClient({ adapter: new PrismaLibSql({ url: `file:///${dbPath}` }) });

const TWELVE_HOURS = 12 * 60 * 60 * 1000;

function isUtcMidnight(d: Date): boolean {
  return (
    d.getUTCHours() === 0 &&
    d.getUTCMinutes() === 0 &&
    d.getUTCSeconds() === 0 &&
    d.getUTCMilliseconds() === 0
  );
}

async function main() {
  let total = 0;

  // ── 1. communication.factDate ─────────────────────────────────────────────
  console.log("\n📋 Comunicações (factDate)…");
  const comms = await prisma.communication.findMany({ select: { id: true, factDate: true } });
  for (const c of comms) {
    if (!isUtcMidnight(c.factDate)) continue;
    const fixed = new Date(c.factDate.getTime() + TWELVE_HOURS);
    await prisma.communication.update({ where: { id: c.id }, data: { factDate: fixed } });
    console.log(`  ✓ comm ${c.id.slice(0, 8)}…  ${c.factDate.toISOString()} → ${fixed.toISOString()}`);
    total++;
  }

  // ── 2. disciplinaryBookItem.factDate ──────────────────────────────────────
  console.log("\n📒 Itens do caderno (factDate)…");
  const items = await prisma.disciplinaryBookItem.findMany({ select: { id: true, factDate: true } });
  for (const it of items) {
    if (!isUtcMidnight(it.factDate)) continue;
    const fixed = new Date(it.factDate.getTime() + TWELVE_HOURS);
    await prisma.disciplinaryBookItem.update({ where: { id: it.id }, data: { factDate: fixed } });
    console.log(`  ✓ item ${it.id.slice(0, 8)}…  ${it.factDate.toISOString()} → ${fixed.toISOString()}`);
    total++;
  }

  // ── 3. aacp.saturdayDate e aacp.sundayDate ────────────────────────────────
  console.log("\n📅 AACPs (saturdayDate / sundayDate)…");
  const aacps = await prisma.aacp.findMany({ select: { id: true, saturdayDate: true, sundayDate: true } });
  for (const a of aacps) {
    const updates: { saturdayDate?: Date; sundayDate?: Date } = {};

    if (isUtcMidnight(a.saturdayDate)) {
      updates.saturdayDate = new Date(a.saturdayDate.getTime() + TWELVE_HOURS);
      console.log(`  ✓ aacp ${a.id.slice(0, 8)}… sáb  ${a.saturdayDate.toISOString()} → ${updates.saturdayDate.toISOString()}`);
      total++;
    }
    if (isUtcMidnight(a.sundayDate)) {
      updates.sundayDate = new Date(a.sundayDate.getTime() + TWELVE_HOURS);
      console.log(`  ✓ aacp ${a.id.slice(0, 8)}… dom  ${a.sundayDate.toISOString()} → ${updates.sundayDate.toISOString()}`);
      total++;
    }

    if (Object.keys(updates).length > 0) {
      await prisma.aacp.update({ where: { id: a.id }, data: updates });
    }
  }

  console.log(`\n✅ Migração concluída: ${total} data(s) corrigida(s).`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
