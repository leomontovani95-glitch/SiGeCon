import { prisma } from "@/lib/db";
import { verifySession } from "@/lib/dal";
import { redirect } from "next/navigation";
import { notFound } from "next/navigation";
import AlunoForm from "../../_components/AlunoForm";
import ResetarSenhaAlunoBtn from "../../_components/ResetarSenhaAlunoBtn";
import CriarContaAlunoBtn from "../../_components/CriarContaAlunoBtn";

const PODE_RESETAR = ["ADMINISTRADOR", "CHEFE_DIVISAO_ACADEMICA", "COMANDANTE_ESFAP", "COMANDANTE_ESFO"];

export default async function EditarAlunoPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await verifySession();
  if (session.role === "ALUNO") redirect("/acesso-negado");

  const { id } = await params;
  const [aluno, courses] = await Promise.all([
    prisma.student.findUnique({
      where: { id },
      include: { course: true, platoon: true },
    }),
    prisma.course.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      include: { platoons: { where: { active: true }, orderBy: { name: "asc" } } },
    }),
  ]);
  if (!aluno) notFound();

  const podeResetar = PODE_RESETAR.includes(session.role);

  return (
    <div className="p-6 max-w-3xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Editar Aluno</h1>
      <AlunoForm
        id={aluno.id}
        courses={courses}
        defaultValues={{
          fullName: aluno.fullName,
          warName: aluno.warName,
          courseNumber: aluno.courseNumber,
          rg: aluno.rg,
          functionalNumber: aluno.functionalNumber ?? "",
          status: aluno.status,
          courseId: aluno.courseId,
          platoonId: aluno.platoonId ?? "",
        }}
      />
      {podeResetar && (
        aluno.userId
          ? <ResetarSenhaAlunoBtn studentId={aluno.id} />
          : <CriarContaAlunoBtn   studentId={aluno.id} />
      )}
    </div>
  );
}
