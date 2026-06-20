import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { verifySession, verifyStaff, ESFO_CFO_RANK, cursosPermitidosParaCPI } from "@/lib/dal";
import ComunicacaoForm from "../../_components/ComunicacaoForm";

export default async function NovaCPIPage() {
  const session = await verifySession();
  const isAluno = session.role === "ALUNO";

  let comunicanteFixo: { userId: string; rank: string; name: string; fullName: string; detail: string } | undefined;
  let allowedCourseIds: string[] | undefined;

  if (isAluno) {
    const [student, allCourses] = await Promise.all([
      prisma.student.findFirst({
        where: { userId: session.userId },
        include: { course: true, user: true },
      }),
      prisma.course.findMany({ where: { active: true }, select: { id: true, name: true, school: true } }),
    ]);
    if (!student) redirect("/acesso-negado");
    if (!(student.course.name in ESFO_CFO_RANK)) redirect("/acesso-negado");

    allowedCourseIds = cursosPermitidosParaCPI(student.course.name, allCourses);
    comunicanteFixo = {
      userId: session.userId,
      rank: student.user?.rank ?? "",
      name: student.warName,
      fullName: student.fullName,
      detail: `Nº ${student.courseNumber} | ${student.course.name}`,
    };
  } else {
    await verifyStaff();
  }

  const [tipos, regras, cursos] = await Promise.all([
    prisma.communicationType.findMany({
      where: { active: true, name: { in: ["CPI 1", "CPI 2", "CPI 3"] } },
      orderBy: { name: "asc" },
    }),
    prisma.manualRule.findMany({
      // Dispositivos cujo tipo sugerido é uma CPI — independe do número do
      // artigo (assim, artigos fora da faixa antiga, ex.: 141 ou 155, aparecem
      // automaticamente ao serem cadastrados como CPI 1/2/3).
      where: {
        active: true,
        defaultCommunicationType: { in: ["CPI 1", "CPI 2", "CPI 3"] },
      },
      orderBy: [{ article: "asc" }, { item: "asc" }, { letter: "asc" }],
    }),
    prisma.course.findMany({
      where: {
        active: true,
        ...(allowedCourseIds !== undefined ? { id: { in: allowedCourseIds } } : {}),
      },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div className="p-6 max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Nova CPI</h1>
        {!isAluno && (
          <Link href="/comunicacoes/nova/lote" className="text-sm text-[#1e3a5f] hover:underline font-medium">
            Registrar para múltiplos alunos →
          </Link>
        )}
      </div>
      <ComunicacaoForm tipos={tipos} regras={regras} cursos={cursos} comunicanteFixo={comunicanteFixo} />
    </div>
  );
}
