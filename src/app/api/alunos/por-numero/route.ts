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
  if (!q) return NextResponse.json({ alunos: [] });

  // Aluno CFO: validar se o courseId solicitado está nos cursos permitidos
  if (session.role === "ALUNO") {
    if (!courseId) return NextResponse.json({ alunos: [] });
    const [reporter, allCourses] = await Promise.all([
      prisma.student.findFirst({ where: { userId: session.userId }, include: { course: true } }),
      prisma.course.findMany({ where: { active: true }, select: { id: true, name: true, school: true } }),
    ]);
    if (!reporter || !(reporter.course.name in ESFO_CFO_RANK)) return NextResponse.json({ alunos: [] });
    const allowedIds = cursosPermitidosParaCPI(reporter.course.name, allCourses);
    if (!allowedIds.includes(courseId)) return NextResponse.json({ alunos: [] });
  }

  // Aceita o número digitado tanto na forma original ("1") quanto padronizada ("01").
  // Busca por número de curso, nome de guerra ou nome completo — retorna lista.
  const qPadded = formatCourseNumber(q);
  const encontrados = await prisma.student.findMany({
    where: {
      OR: [
        { courseNumber: q },
        { courseNumber: qPadded },
        { warName:  { contains: q } },
        { fullName: { contains: q } },
      ],
      status: "ATIVO",
      ...(courseId ? { courseId } : {}),
    },
    include: { course: true, platoon: true },
    orderBy: [{ courseNumber: "asc" }],
    take: 20,
  });

  // Staff: respeita o escopo de escola — não retorna aluno de outra escola
  // (ex.: Protocolo da EsFAP não localiza aluno do CFO/EsFO).
  const escopo = session.role !== "ALUNO" ? getSchoolFilter(session.role, session.escola) : null;
  const visiveis = escopo ? encontrados.filter((a) => a.course.school === escopo) : encontrados;

  return NextResponse.json({
    alunos: visiveis.map((aluno) => ({
      id: aluno.id,
      warName: aluno.warName,
      fullName: aluno.fullName,
      courseNumber: aluno.courseNumber,
      course: aluno.course.name,
      platoon: aluno.platoon?.name ?? null,
      rg: aluno.rg,
      functionalNumber: aluno.functionalNumber ?? null,
    })),
  });
}
