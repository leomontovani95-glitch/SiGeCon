import { NextResponse } from "next/server";
import { verifySession } from "@/lib/dal";
import path from "path";
import fs from "fs";

export async function GET() {
  const session = await verifySession();
  if (session.role !== "ADMINISTRADOR") {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  const dbPath = path.resolve(process.cwd(), "dev.db");
  if (!fs.existsSync(dbPath)) {
    return NextResponse.json({ error: "Arquivo dev.db não encontrado" }, { status: 404 });
  }

  const buffer = fs.readFileSync(dbPath);
  const now = new Date();
  const ts = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}_${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}`;

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename="sigeco_backup_${ts}.db"`,
    },
  });
}
