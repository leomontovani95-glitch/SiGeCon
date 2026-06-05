import { prisma } from "@/lib/db";
import { verifyStaff } from "@/lib/dal";
import ComunicacaoForm from "../../_components/ComunicacaoForm";

export default async function NovoElogioBIPage() {
  await verifyStaff();
  const [tipos, regras] = await Promise.all([
    prisma.communicationType.findMany({
      where: { active: true, name: { in: ["Elogio publicado em BI"] } },
    }),
    prisma.manualRule.findMany({
      where: { active: true, article: "170", defaultCommunicationType: "Elogio publicado em BI" },
      orderBy: [{ item: "asc" }],
    }),
  ]);
  return (
    <div className="p-6 max-w-3xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Elogio Publicado em BI</h1>
      <p className="text-sm text-gray-500 mb-6">Acrescenta <strong>+1,0 pt</strong> na nota de conduta.</p>
      <ComunicacaoForm tipos={tipos} regras={regras} />
    </div>
  );
}
