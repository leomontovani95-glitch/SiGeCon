import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  if (!q || q.length < 2) return NextResponse.json({ results: [] });

  const users = await prisma.user.findMany({
    where: {
      active: true,
      OR: [
        { fullName: { contains: q } },
        { warName: { contains: q } },
        { rg: { contains: q } },
        { functionalNumber: { contains: q } },
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
