import { prisma } from "@/lib/db";
import { verifyStaff } from "@/lib/dal";
import ComunicacaoForm from "../../_components/ComunicacaoForm";

export default async function NovaReferenciaPage() {
  await verifyStaff();
  const [tipos, regras, cursos] = await Promise.all([
    prisma.communicationType.findMany({
      where: { active: true, name: { in: ["Referência Elogiosa"] } },
    }),
    prisma.manualRule.findMany({
      where: { active: true, article: "170", defaultCommunicationType: "Referência Elogiosa" },
      orderBy: [{ item: "asc" }],
    }),
    prisma.course.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
    }),
  ]);
  return (
    <div className="p-6 max-w-3xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Nova Referência Elogiosa</h1>
      <ComunicacaoForm tipos={tipos} regras={regras} cursos={cursos} />
    </div>
  );
}
