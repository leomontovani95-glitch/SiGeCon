import { NextResponse, type NextRequest } from "next/server";
import { verifySession, getSchoolFilter, temVistaRestritaComunicacao } from "@/lib/dal";
import { prisma } from "@/lib/db";
import { resolveUploadPath } from "@/lib/uploads";
import fs from "fs";

// Servir anexos com autenticação. Substitui o acesso estático antigo a
// `public/uploads/...` (que expunha defesas/provas/pareceres/decisões sem
// qualquer controle). Replica as mesmas regras de acesso da página da
// comunicação (escopo por escola; vista restrita para comunicante/apoio).
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await verifySession();
  const { id } = await ctx.params;

  const att = await prisma.attachment.findUnique({
    where: { id },
    include: {
      communication: {
        select: {
          communicantUserId: true,
          student: { select: { userId: true, course: { select: { school: true } } } },
        },
      },
    },
  });
  if (!att?.communication?.student) {
    return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
  }

  const comm = att.communication;

  // Mesma regra de acesso da página da comunicação (404 para não vazar existência).
  let ehComunicante = false;
  if (session.role === "ALUNO") {
    const ehEsteAluno = comm.student.userId === session.userId;
    ehComunicante = comm.communicantUserId === session.userId && !ehEsteAluno;
    if (!ehEsteAluno && comm.communicantUserId !== session.userId) {
      return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
    }
  } else {
    const escopo = getSchoolFilter(session.role, session.escola);
    if (escopo && comm.student.course.school !== escopo) {
      return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
    }
  }

  // Vista restrita (comunicante / perfis de apoio): só meios de prova; defesa,
  // parecer e decisão ficam reservados — mesma regra de exibição da página.
  const vistaRestrita = ehComunicante || temVistaRestritaComunicacao(session.role);
  const categoriaReservada = !!(att.defenseId || att.opinionId || att.decisionId);
  if (vistaRestrita && categoriaReservada) {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
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
