import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  if (!q || q.length < 2) return NextResponse.json({ results: [] });

  const [users, students] = await Promise.all([
    prisma.user.findMany({
      where: {
        active: true,
        OR: [
          { fullName: { contains: q } },
          { warName: { contains: q } },
          { rg: { contains: q } },
          { functionalNumber: { contains: q } },
        ],
      },
      select: { id: true, rank: true, warName: true, fullName: true, rg: true, functionalNumber: true },
      take: 8,
      orderBy: { warName: "asc" },
    }),
    prisma.student.findMany({
      where: {
        status: "ATIVO",
        OR: [
          { fullName: { contains: q } },
          { warName: { contains: q } },
          { rg: { contains: q } },
          { functionalNumber: { contains: q } },
          { courseNumber: { contains: q } },
        ],
      },
      select: { id: true, warName: true, fullName: true, rg: true, functionalNumber: true, courseNumber: true },
      take: 8,
      orderBy: { warName: "asc" },
    }),
  ]);

  const results = [
    ...users.map((u) => ({
      key: `u-${u.id}`,
      rank: u.rank,
      name: u.warName,
      fullName: u.fullName,
      detail: `RG: ${u.rg}${u.functionalNumber ? ` | NF: ${u.functionalNumber}` : ""}`,
      tipo: "Usuário" as const,
    })),
    ...students.map((s) => ({
      key: `s-${s.id}`,
      rank: "",
      name: s.warName,
      fullName: s.fullName,
      detail: `Nº ${s.courseNumber} | RG: ${s.rg}`,
      tipo: "Aluno" as const,
    })),
  ];

  return NextResponse.json({ results });
}
