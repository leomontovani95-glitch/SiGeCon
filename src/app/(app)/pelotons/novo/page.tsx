import { prisma } from "@/lib/db";
import { verifyRole } from "@/lib/dal";
import PelotaoForm from "../_components/PelotaoForm";

export default async function NovoPelotaoPage() {
  await verifyRole("ADMINISTRADOR", "PROTOCOLO");
  const cursos = await prisma.course.findMany({ where: { active: true }, orderBy: { name: "asc" } });
  return (
    <div className="p-6 max-w-xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Novo Pelotão</h1>
      <PelotaoForm cursos={cursos} />
    </div>
  );
}
