import { prisma } from "@/lib/db";
import { verifyRole } from "@/lib/dal";
import { notFound } from "next/navigation";
import PelotaoForm from "../../_components/PelotaoForm";

export default async function EditarPelotaoPage({ params }: { params: Promise<{ id: string }> }) {
  await verifyRole("ADMINISTRADOR", "PROTOCOLO");
  const { id } = await params;
  const [pelotao, cursos] = await Promise.all([
    prisma.platoon.findUnique({ where: { id } }),
    prisma.course.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
  ]);
  if (!pelotao) notFound();
  return (
    <div className="p-6 max-w-xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Editar Pelotão</h1>
      <PelotaoForm id={pelotao.id} cursos={cursos} defaultValues={{ name: pelotao.name, courseId: pelotao.courseId, active: String(pelotao.active) }} />
    </div>
  );
}
