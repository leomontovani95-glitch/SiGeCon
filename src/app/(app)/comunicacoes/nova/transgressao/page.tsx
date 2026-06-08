import { prisma } from "@/lib/db";
import { verifyStaff, getSchoolFilter } from "@/lib/dal";
import TransgressaoForm from "../../_components/TransgressaoForm";

export default async function NovaTransgressaoPage() {
  const session = await verifyStaff();
  const school = getSchoolFilter(session.role, session.escola);
  const cursos = await prisma.course.findMany({
    where: { active: true, ...(school ? { school } : {}) },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
  return (
    <div className="p-6 max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Nova Transgressão Disciplinar / TAC</h1>
        <p className="text-sm text-gray-500 mt-1">
          Registro de sanção disciplinar publicada em BGPM — o lançamento vai diretamente para o caderno rascunho do curso.
        </p>
      </div>
      <TransgressaoForm cursos={cursos} />
    </div>
  );
}
