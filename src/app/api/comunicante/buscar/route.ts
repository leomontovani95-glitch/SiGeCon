import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { getSchoolFilter } from "@/lib/dal";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  if (!q || q.length < 2) return NextResponse.json({ results: [] });

  // Isolamento por escola: limita quem aparece na busca ao escopo do usuário.
  // Staff filtra por `escola` (incluindo TODAS/global); aluno filtra pelo curso.
  const escopo = getSchoolFilter(session.role, session.escola);
  const escopoFiltro = escopo
    ? [{
        OR: [
          { role: { not: "ALUNO" }, escola: { in: [escopo, "TODAS"] } },
          { role: "ALUNO", student: { is: { course: { is: { school: escopo } } } } },
        ],
      }]
    : [];

  const users = await prisma.user.findMany({
    where: {
      active: true,
      AND: [
        {
          OR: [
            { fullName: { contains: q } },
            { warName: { contains: q } },
            { rg: { contains: q } },
            { functionalNumber: { contains: q } },
          ],
        },
        ...escopoFiltro,
      ],
    },
    select: {
      id: true, rank: true, warName: true, fullName: true,
      rg: true, functionalNumber: true, role: true,
      student: {
        select: {
          courseNumber: true,
          course: { select: { name: true } },
        },
      },
    },
    take: 12,
    orderBy: { warName: "asc" },
  });

  const results = users.map((u) => ({
    key: `u-${u.id}`,
    userId: u.id,
    rank: u.rank,
    name: u.warName,
    fullName: u.fullName,
    detail: u.role === "ALUNO" && u.student
      ? `Nº ${u.student.courseNumber} | ${u.student.course.name} | RG: ${u.rg}`
      : `RG: ${u.rg}${u.functionalNumber ? ` | NF: ${u.functionalNumber}` : ""}`,
    tipo: (u.role === "ALUNO" ? "Aluno" : "Usuário") as "Aluno" | "Usuário",
  }));

  return NextResponse.json({ results });
}
