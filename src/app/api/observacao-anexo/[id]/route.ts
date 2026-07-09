import { NextResponse, type NextRequest } from "next/server";
import { verifySession, canManageObservacoes, escolaNoEscopo } from "@/lib/dal";
import { prisma } from "@/lib/db";
import { resolveUploadPath } from "@/lib/uploads";
import fs from "fs";

// Servir anexos de OBSERVAÇÕES do histórico do aluno com autenticação. Rota
// separada de /api/anexo/[id] de propósito: aquela assume que todo anexo pertence
// a uma comunicação; observações são um registro interno paralelo. Acesso restrito
// ao mesmo grupo da aba Observações (Oficial de escola p/ cima + APM + Div.
// Acadêmica + Admin), respeitando o escopo de escola do aluno. Aluno nunca passa
// em canManageObservacoes → 404 (não vaza existência).
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await verifySession();
  const { id } = await ctx.params;

  if (!canManageObservacoes(session.role, session.additionalRoles)) {
    return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
  }

  const att = await prisma.observationAttachment.findUnique({
    where: { id },
    include: {
      observation: {
        select: { student: { select: { course: { select: { school: true } } } } },
      },
    },
  });
  if (!att?.observation?.student) {
    return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
  }

  if (!escolaNoEscopo(session, att.observation.student.course.school)) {
    return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
  }

  const abs = att.filePath ? resolveUploadPath(att.filePath) : null;
  if (!abs || !fs.existsSync(abs)) {
    return NextResponse.json({ error: "Arquivo não encontrado" }, { status: 404 });
  }

  const buffer = fs.readFileSync(abs);
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": att.fileType || "application/octet-stream",
      "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(att.fileName)}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
