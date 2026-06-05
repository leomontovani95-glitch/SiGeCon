import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  if (!q) return NextResponse.json({ aluno: null });

  const aluno = await prisma.student.findFirst({
    where: { courseNumber: q, status: "ATIVO" },
    include: { course: true, platoon: true },
  });

  if (!aluno) return NextResponse.json({ aluno: null });

  return NextResponse.json({
    aluno: {
      id: aluno.id,
      warName: aluno.warName,
      fullName: aluno.fullName,
      courseNumber: aluno.courseNumber,
      course: aluno.course.name,
      platoon: aluno.platoon?.name ?? null,
    },
  });
}
