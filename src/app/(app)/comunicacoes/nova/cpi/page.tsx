import { prisma } from "@/lib/db";
import { verifyStaff } from "@/lib/dal";
import ComunicacaoForm from "../../_components/ComunicacaoForm";

export default async function NovaCPIPage() {
  await verifyStaff();
  const [tipos, regras, cursos] = await Promise.all([
    prisma.communicationType.findMany({
      where: { active: true, name: { in: ["CPI 0", "CPI 1", "CPI 2", "CPI 3"] } },
      orderBy: { name: "asc" },
    }),
    // Art. 142 a 154 — transgressões escolares
    prisma.manualRule.findMany({
      where: {
        active: true,
        article: { in: ["142","143","144","145","146","147","148","149","150","151","152","153","154"] },
      },
      orderBy: [{ article: "asc" }, { item: "asc" }, { letter: "asc" }],
    }),
    prisma.course.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
    }),
  ]);
  return (
    <div className="p-6 max-w-3xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Nova CPI</h1>
      <ComunicacaoForm tipos={tipos} regras={regras} cursos={cursos} />
    </div>
  );
}
