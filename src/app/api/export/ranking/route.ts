import { NextRequest, NextResponse } from "next/server";
import { verifySession, getSchoolFilter } from "@/lib/dal";
import { prisma } from "@/lib/db";
import { calcularNotaPublicada } from "@/lib/score";

export async function GET(req: NextRequest) {
  const session = await verifySession();
  if (session.role === "ALUNO") {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const cursoId = searchParams.get("cursoId") ?? "";
  const school = getSchoolFilter(session.role, session.escola);

  const cursosDisponiveis = await prisma.course.findMany({
    where: { active: true, ...(school ? { school } : {}) },
    select: { id: true, name: true },
  });
  const scopeIds = cursoId
    ? [cursoId]
    : cursosDisponiveis.map((c) => c.id);

  const students = await prisma.student.findMany({
    where: { status: "ATIVO", courseId: { in: scopeIds } },
    include: { course: true, platoon: true },
  });
  // Notas agregadas por aluno (studentId): o histórico acompanha o remanescente.
  const publishedItems = await prisma.disciplinaryBookItem.findMany({
    where: { disciplinaryBook: { status: "PUBLICADO" }, studentId: { in: students.map((s) => s.id) } },
    include: { communication: { include: { type: { select: { scoreNature: true } } } } },
  });

  const pubPorAluno = new Map<string, typeof publishedItems>();
  for (const item of publishedItems) {
    if (!pubPorAluno.has(item.studentId)) pubPorAluno.set(item.studentId, []);
    pubPorAluno.get(item.studentId)!.push(item);
  }

  const rows = students
    .map((s) => ({
      nota: calcularNotaPublicada(pubPorAluno.get(s.id) ?? []),
      courseNumber: s.courseNumber,
      warName: s.warName,
      fullName: s.fullName,
      course: s.course.name,
      platoon: s.platoon?.name ?? "",
    }))
    .sort((a, b) => b.nota - a.nota);

  const header = "Posição,Nº,Nome de Guerra,Nome Completo,Curso,Pelotão,Nota\r\n";
  const body = rows
    .map(
      (r, i) =>
        `${i + 1},"${r.courseNumber}","${r.warName}","${r.fullName}","${r.course}","${r.platoon}",${r.nota.toFixed(2)}`
    )
    .join("\r\n");

  return new NextResponse(header + body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="ranking-conduta.csv"`,
    },
  });
}
