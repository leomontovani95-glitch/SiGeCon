import { verifyStaff, VIEWERS_APM, getSchoolFilter } from "@/lib/dal";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import AlunoForm from "../_components/AlunoForm";

export default async function NovoAlunoPage() {
  const session = await verifyStaff();
  if ((VIEWERS_APM as string[]).includes(session.role)) redirect("/acesso-negado");
  // Escopo de escola: só aparecem cursos da escola atribuída ao usuário.
  const school = getSchoolFilter(session.role, session.escola);
  const courses = await prisma.course.findMany({
    where: { active: true, ...(school ? { school } : {}) },
    orderBy: { name: "asc" },
    include: { platoons: { where: { active: true }, orderBy: { name: "asc" } } },
  });
  return (
    <div className="p-6 max-w-3xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Novo Aluno</h1>
      <AlunoForm courses={courses} />
    </div>
  );
}
