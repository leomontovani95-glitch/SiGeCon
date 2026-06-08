import { prisma } from "@/lib/db";
import { verifyRole } from "@/lib/dal";
import { notFound } from "next/navigation";
import CursoForm from "../../_components/CursoForm";
import GerenciarPelotoes from "../../_components/GerenciarPelotoes";

export default async function EditarCursoPage({ params }: { params: Promise<{ id: string }> }) {
  await verifyRole("ADMINISTRADOR", "PROTOCOLO", "COMANDANTE_ESFAP", "COMANDANTE_ESFO", "CHEFE_DIVISAO_ACADEMICA", "SUBCOMANDANTE_ESFAP", "SUBCOMANDANTE_ESFO", "OFICIAL_ESFAP", "OFICIAL_ESFO");
  const { id } = await params;
  const curso = await prisma.course.findUnique({
    where: { id },
    include: {
      platoons: {
        include: { _count: { select: { students: true } } },
        orderBy: { name: "asc" },
      },
    },
  });
  if (!curso) notFound();

  return (
    <div className="p-6 max-w-xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Editar Curso</h1>
      <CursoForm
        id={curso.id}
        defaultValues={{
          name: curso.name,
          acronym: curso.acronym,
          school: curso.school ?? "",
          year: String(curso.year ?? ""),
          description: curso.description ?? "",
          active: String(curso.active),
        }}
      />
      <GerenciarPelotoes
        courseId={curso.id}
        platoons={curso.platoons.map((p) => ({ id: p.id, name: p.name, studentCount: p._count.students }))}
      />
    </div>
  );
}
