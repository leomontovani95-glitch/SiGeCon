import { prisma } from "@/lib/db";
import { verifyStaff, getSchoolFilter } from "@/lib/dal";
import ElogioBiForm from "../../_components/ElogioBiForm";

export default async function NovoElogioBIPage() {
  const session = await verifyStaff();
  const school = getSchoolFilter(session.role, session.escola);

  const [regras, cursos] = await Promise.all([
    prisma.manualRule.findMany({
      where: { active: true, defaultCommunicationType: "Elogio publicado em BI" },
      orderBy: [{ article: "asc" }, { item: "asc" }],
      select: { id: true, article: true, item: true, letter: true, description: true },
    }),
    prisma.course.findMany({
      where: { active: true, ...(school ? { school } : {}) },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  return (
    <div className="p-6 max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Elogio Publicado em BI</h1>
        <p className="text-sm text-gray-500 mt-1">
          Registro de elogio publicado em Boletim Interno — o lançamento vai diretamente para o caderno rascunho do curso.
        </p>
      </div>
      <ElogioBiForm regras={regras} cursos={cursos} />
    </div>
  );
}
