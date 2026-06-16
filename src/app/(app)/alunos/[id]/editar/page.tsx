import { prisma } from "@/lib/db";
import { verifySession } from "@/lib/dal";
import { redirect } from "next/navigation";
import { notFound } from "next/navigation";
import { platoonOrder } from "@/lib/utils";
import AlunoForm from "../../_components/AlunoForm";
import ResetarSenhaAlunoBtn from "../../_components/ResetarSenhaAlunoBtn";
import CriarContaAlunoBtn from "../../_components/CriarContaAlunoBtn";
import MudancaCursoPanel from "../../_components/MudancaCursoPanel";

const PODE_RESETAR = ["ADMINISTRADOR", "CHEFE_DIVISAO_ACADEMICA", "COMANDANTE_ESFAP", "COMANDANTE_ESFO"];
// Perfis autorizados a mover alunos de curso (ascensão / remanescente).
const PODE_MOVER_CURSO = [
  "ADMINISTRADOR", "CHEFE_DIVISAO_ACADEMICA",
  "COMANDANTE_ESFAP", "COMANDANTE_ESFO",
  "SUBCOMANDANTE_ESFAP", "SUBCOMANDANTE_ESFO",
];

export default async function EditarAlunoPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await verifySession();
  if (session.role === "ALUNO") redirect("/acesso-negado");

  const { id } = await params;
  const aluno = await prisma.student.findUnique({
    where: { id },
    include: { course: true, platoon: true },
  });
  if (!aluno) notFound();

  // Inclui também o curso atual (mesmo inativo) para que apareça no seletor de curso.
  const courses = await prisma.course.findMany({
    where: { OR: [{ active: true }, { id: aluno.courseId }] },
    orderBy: { name: "asc" },
    include: { platoons: { where: { active: true }, orderBy: { name: "asc" } } },
  });

  const podeResetar = PODE_RESETAR.includes(session.role);
  const podeMoverCurso = PODE_MOVER_CURSO.includes(session.role);

  const cursosAtivos = courses.filter((c) => c.active && c.id !== aluno.courseId);

  // Pelotões (ativos) de cada curso de destino, em ordem numérica.
  const pelotoesDoCurso = (c: (typeof cursosAtivos)[number]) =>
    [...c.platoons].sort((a, b) => platoonOrder(a.name) - platoonOrder(b.name)).map((p) => ({ id: p.id, name: p.name }));

  // Ascensão pode cruzar escolas (ex.: CFSd/EsFAP -> CFO/EsFO): todos os cursos ativos.
  const destinosAscensao = cursosAtivos.map((c) => ({ id: c.id, name: c.name, platoons: pelotoesDoCurso(c) }));

  // Remanescente mantém a mesma escola (mesmo regime escolar).
  const destinoCoursesRemanescente = cursosAtivos.filter((c) => c.school === aluno.course.school);

  // Próximo número remanescente (sequencial) por curso de destino: "01-R", "02-R"...
  const remanescentes = await prisma.student.findMany({
    where: { courseId: { in: destinoCoursesRemanescente.map((c) => c.id) }, courseNumber: { endsWith: "-R" } },
    select: { courseId: true, courseNumber: true },
  });
  const maxPorCurso = new Map<string, number>();
  for (const s of remanescentes) {
    const n = parseInt(s.courseNumber, 10);
    if (Number.isFinite(n)) maxPorCurso.set(s.courseId, Math.max(maxPorCurso.get(s.courseId) ?? 0, n));
  }
  const destinosRemanescente = destinoCoursesRemanescente.map((c) => ({
    id: c.id,
    name: c.name,
    proximoNumero: `${String((maxPorCurso.get(c.id) ?? 0) + 1).padStart(2, "0")}-R`,
    platoons: pelotoesDoCurso(c),
  }));

  return (
    <div className="p-6 max-w-3xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Editar Aluno</h1>
      <AlunoForm
        id={aluno.id}
        courses={courses}
        defaultValues={{
          fullName: aluno.fullName,
          warName: aluno.warName,
          courseNumber: aluno.courseNumber,
          rg: aluno.rg,
          functionalNumber: aluno.functionalNumber ?? "",
          status: aluno.status,
          courseId: aluno.courseId,
          platoonId: aluno.platoonId ?? "",
        }}
      />
      {podeResetar && (
        aluno.userId
          ? <ResetarSenhaAlunoBtn studentId={aluno.id} />
          : <CriarContaAlunoBtn   studentId={aluno.id} />
      )}

      {podeMoverCurso && (
        <MudancaCursoPanel
          studentId={aluno.id}
          currentCourseName={aluno.course.name}
          currentNumber={aluno.courseNumber}
          destinosRemanescente={destinosRemanescente}
          destinosAscensao={destinosAscensao}
        />
      )}
    </div>
  );
}
