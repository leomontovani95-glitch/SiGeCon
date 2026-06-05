import { prisma } from "@/lib/db";
import { verifyRole } from "@/lib/dal";
import { notFound } from "next/navigation";
import CursoForm from "../../_components/CursoForm";

export default async function EditarCursoPage({ params }: { params: Promise<{ id: string }> }) {
  await verifyRole("ADMINISTRADOR", "PROTOCOLO", "COMANDANTE_ESFAP", "COMANDANTE_ESFO");
  const { id } = await params;
  const curso = await prisma.course.findUnique({ where: { id }, include: { _count: { select: { platoons: true } } } });
  if (!curso) notFound();

  return (
    <div className="p-6 max-w-xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Editar Curso</h1>
      <CursoForm id={curso.id} currentPlatoonCount={curso._count.platoons} defaultValues={{ name: curso.name, acronym: curso.acronym, school: curso.school ?? "", year: String(curso.year ?? ""), description: curso.description ?? "", active: String(curso.active) }} />
    </div>
  );
}
