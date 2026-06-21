import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { ESFO_CFO_RANK, cursosPermitidosParaCPI, getSchoolFilter } from "@/lib/dal";
import { formatCourseNumber } from "@/lib/utils";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const q        = (req.nextUrl.searchParams.get("q")        ?? "").trim();
  const courseId = (req.nextUrl.searchParams.get("courseId") ?? "").trim();
  if (!q) return NextResponse.json({ aluno: null });

  // Aluno CFO: validar se o courseId solicitado está nos cursos permitidos
  if (session.role === "ALUNO") {
    if (!courseId) return NextResponse.json({ aluno: null });
    const [reporter, allCourses] = await Promise.all([
      prisma.student.findFirst({ where: { userId: session.userId }, include: { course: true } }),
      prisma.course.findMany({ where: { active: true }, select: { id: true, name: true, school: true } }),
    ]);
    if (!reporter || !(reporter.course.name in ESFO_CFO_RANK)) return NextResponse.json({ aluno: null });
    const allowedIds = cursosPermitidosParaCPI(reporter.course.name, allCourses);
    if (!allowedIds.includes(courseId)) return NextResponse.json({ aluno: null });
  }

  // Aceita o número digitado tanto na forma original ("1") quanto padronizada ("01").
  const qPadded = formatCourseNumber(q);
  const aluno = await prisma.student.findFirst({
    where: {
      OR: [
        { courseNumber: q },
        { courseNumber: qPadded },
        { warName: { contains: q } },
      ],
      status: "ATIVO",
      ...(courseId ? { courseId } : {}),
    },
    include: { course: true, platoon: true },
  });

  if (!aluno) return NextResponse.json({ aluno: null });

  // Staff: respeita o escopo de escola — não retorna aluno de outra escola
  // (ex.: Protocolo da EsFAP não localiza aluno do CFO/EsFO).
  if (session.role !== "ALUNO") {
    const escopo = getSchoolFilter(session.role, session.escola);
    if (escopo && aluno.course.school !== escopo) return NextResponse.json({ aluno: null });
  }

  return NextResponse.json({
    aluno: {
      id: aluno.id,
      warName: aluno.warName,
      fullName: aluno.fullName,
      courseNumber: aluno.courseNumber,
      course: aluno.course.name,
      platoon: aluno.platoon?.name ?? null,
      rg: aluno.rg,
      functionalNumber: aluno.functionalNumber ?? null,
    },
  });
}
