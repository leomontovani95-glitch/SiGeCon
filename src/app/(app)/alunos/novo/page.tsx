import { verifyStaff, VIEWERS_APM } from "@/lib/dal";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import AlunoForm from "../_components/AlunoForm";

export default async function NovoAlunoPage() {
  const session = await verifyStaff();
  if ((VIEWERS_APM as string[]).includes(session.role)) redirect("/acesso-negado");
  const courses = await prisma.course.findMany({
    where: { active: true },
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
