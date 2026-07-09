import { prisma } from "@/lib/db";
import { verifySession, canManageObservacoes, podeEditarObservacao, escolaNoEscopo } from "@/lib/dal";
import { notFound } from "next/navigation";
import Link from "next/link";
import { formatCourseNumber } from "@/lib/utils";
import AlunoTabs from "../_components/AlunoTabs";
import ObservacoesPanel, { type ObsItem } from "./_components/ObservacoesPanel";

export default async function ObservacoesAlunoPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await verifySession();
  const { id } = await params;

  // Acesso restrito ao grupo autorizado. Aluno e perfis sem acesso recebem 404
  // (não vaza a existência da aba/registro).
  if (!canManageObservacoes(session.role, session.additionalRoles)) notFound();

  const aluno = await prisma.student.findUnique({
    where: { id },
    include: { course: true, platoon: true },
  });
  if (!aluno) notFound();

  // Escopo de escola: Oficial/Cmt de escola só acessa alunos da própria escola.
  if (!escolaNoEscopo(session, aluno.course.school)) notFound();

  const observacoes = await prisma.studentObservation.findMany({
    where: { studentId: id },
    include: {
      author: { select: { rank: true, warName: true } },
      attachments: { select: { id: true, fileName: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const items: ObsItem[] = observacoes.map((o) => ({
    id: o.id,
    nature: o.nature,
    text: o.text,
    createdAt: o.createdAt.toISOString(),
    editedAt: o.editedAt ? o.editedAt.toISOString() : null,
    authorLabel: `${o.author.rank} ${o.author.warName}`.trim(),
    canEdit: podeEditarObservacao(session, o),
    attachments: o.attachments,
  }));

  return (
    <div className="p-6 max-w-4xl">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{aluno.warName}</h1>
          <p className="text-sm text-gray-500">
            {aluno.fullName} · {aluno.course.name} · Nº {formatCourseNumber(aluno.courseNumber)}
          </p>
        </div>
        <Link href={`/alunos/${aluno.id}`} className="btn-secondary text-xs">Voltar ao perfil</Link>
      </div>

      <AlunoTabs studentId={aluno.id} active="observacoes" showObservacoes />

      <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-2.5 mb-4 text-xs text-amber-800">
        Registro interno restrito. Não aparece no PDF do histórico nem é visível ao aluno.
      </div>

      <ObservacoesPanel studentId={aluno.id} observacoes={items} />
    </div>
  );
}
