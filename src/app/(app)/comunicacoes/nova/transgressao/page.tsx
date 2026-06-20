import { prisma } from "@/lib/db";
import { verifyStaff, getSchoolFilter } from "@/lib/dal";
import TransgressaoForm from "../../_components/TransgressaoForm";

export default async function NovaTransgressaoPage() {
  const session = await verifyStaff();
  const school = getSchoolFilter(session.role, session.escola);
  const [cursos, tdTipos] = await Promise.all([
    prisma.course.findMany({
      where: { active: true, ...(school ? { school } : {}) },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    // Pontuação dos TD vem de Tipos de Comunicação (fonte única), não fixa no form.
    prisma.communicationType.findMany({
      where: { name: { in: ["TD Leve", "TD Média", "TD Grave"] } },
      select: { name: true, score: true },
    }),
  ]);
  const tdScores: Record<string, number> = Object.fromEntries(tdTipos.map((t) => [t.name, t.score]));
  return (
    <div className="p-6 max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Nova Transgressão Disciplinar / TAC</h1>
        <p className="text-sm text-gray-500 mt-1">
          Registro de sanção disciplinar publicada em BGPM — o lançamento vai diretamente para o caderno rascunho do curso.
        </p>
      </div>
      <TransgressaoForm cursos={cursos} tdScores={tdScores} />
    </div>
  );
}
