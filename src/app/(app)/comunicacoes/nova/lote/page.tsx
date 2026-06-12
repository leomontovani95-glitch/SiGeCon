import { prisma } from "@/lib/db";
import { verifyStaff } from "@/lib/dal";
import ComunicacaoLoteForm from "../../_components/ComunicacaoLoteForm";

export default async function NovaComunicacaoLotePage() {
  await verifyStaff();

  const [tipos, regras, cursos] = await Promise.all([
    prisma.communicationType.findMany({
      where: { active: true, name: { in: ["CPI 0", "CPI 1", "CPI 2", "CPI 3", "Referência Elogiosa"] } },
      orderBy: { name: "asc" },
    }),
    prisma.manualRule.findMany({
      where: { active: true },
      orderBy: [{ article: "asc" }, { item: "asc" }, { letter: "asc" }],
    }),
    prisma.course.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="p-6 max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Registro em Lote</h1>
        <p className="text-sm text-gray-500 mt-1">
          Registre a mesma ocorrência para múltiplos alunos de uma vez. Cada aluno receberá uma comunicação individual com protocolo próprio.
        </p>
      </div>
      <ComunicacaoLoteForm tipos={tipos} regras={regras} cursos={cursos} />
    </div>
  );
}
