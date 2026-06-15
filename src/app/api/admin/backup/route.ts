import { NextResponse } from "next/server";
import { verifySession } from "@/lib/dal";
import { prisma, dbFilePath } from "@/lib/db";
import { auditLog } from "@/lib/audit";
import { logger } from "@/lib/logger";
import fs from "fs";

export async function GET() {
  const session = await verifySession();
  if (session.role !== "ADMINISTRADOR") {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  const dbPath = dbFilePath();
  if (!dbPath || !fs.existsSync(dbPath)) {
    return NextResponse.json({ error: "Banco de dados não encontrado." }, { status: 404 });
  }

  // Descarrega o WAL para o arquivo principal antes de ler → backup consistente
  // (caso contrário, transações recentes ficariam só no arquivo .db-wal).
  try {
    await prisma.$queryRawUnsafe("PRAGMA wal_checkpoint(TRUNCATE)");
  } catch (e) {
    logger.warn("backup: wal_checkpoint falhou; lendo o arquivo mesmo assim", e);
  }

  const buffer = fs.readFileSync(dbPath);
  const now = new Date();
  const ts =
    `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}` +
    `_${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}`;

  // Auditoria: o backup exporta o banco inteiro (inclui hashes de senha).
  await auditLog(session.userId, "BACKUP", "Database", undefined, `Backup do banco (${Math.round(buffer.length / 1024)} KB)`)
    .catch((e) => logger.error("backup: auditLog", e));

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename="sigecon_backup_${ts}.db"`,
    },
  });
}
