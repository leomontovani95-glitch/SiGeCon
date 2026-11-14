import "server-only";
import { prisma } from "@/lib/db";
import { getSchoolFilter, temVistaRestritaComunicacao } from "@/lib/roles";

// Regras de ACESSO a registros individuais (comunicação / ficha de aluno),
// compartilhadas pelas páginas que exibem ou imprimem dados sensíveis. Espelham
// a regra da página principal da comunicação (comunicacoes/[id]/page.tsx), para
// que nenhuma página "filha" (impressão de decisão, parecer, termo de ciência)
// fique mais aberta do que ela.

type SessaoAcesso = { userId: string; role: string; escola?: string | null };

type ComunicacaoAcesso = {
  communicantUserId: string | null;
  student: { userId: string | null; rg: string; course: { school: string | null } };
};

export type AcessoComunicacao = {
  // Pode abrir a comunicação.
  permitido: boolean;
  // Só vê o andamento: defesa, parecer e decisão ficam reservados (aluno
  // comunicante e perfis de apoio — Chefe de Curso / Protocolo).
  vistaRestrita: boolean;
};

export async function acessoComunicacao(
  session: SessaoAcesso,
  comm: ComunicacaoAcesso,
): Promise<AcessoComunicacao> {
  if (session.role === "ALUNO") {
    const ehEsteAluno = comm.student.userId === session.userId;
    const ehComunicante = comm.communicantUserId === session.userId && !ehEsteAluno;
    if (ehEsteAluno) return { permitido: true, vistaRestrita: false };
    if (ehComunicante) return { permitido: true, vistaRestrita: true };
    // Matrícula anterior (userId=null após ascensão de curso): confere por RG.
    const atual = await prisma.student.findFirst({
      where: { userId: session.userId },
      select: { rg: true },
    });
    return { permitido: !!atual && atual.rg === comm.student.rg, vistaRestrita: false };
  }

  // Staff: isolamento por escola + vista restrita dos perfis de apoio.
  const escopo = getSchoolFilter(session.role, session.escola);
  const permitido = !escopo || comm.student.course.school === escopo;
  return { permitido, vistaRestrita: temVistaRestritaComunicacao(session.role) };
}

// Staff com escopo de escola só abre a ficha/histórico de alunos da própria
// escola. Exceção: a mesma pessoa (mesmo RG) com matrícula em curso da escola do
// usuário — ex.: ascensão CFSd/EsFAP → CFO/EsFO —, para que os "cadastros
// anteriores" do aluno continuem acessíveis a quem o comanda hoje.
export async function staffPodeVerAluno(
  session: SessaoAcesso,
  aluno: { rg: string; course: { school: string | null } },
): Promise<boolean> {
  const escopo = getSchoolFilter(session.role, session.escola);
  if (!escopo || aluno.course.school === escopo) return true;
  const outraMatricula = await prisma.student.findFirst({
    where: { rg: aluno.rg, course: { school: escopo } },
    select: { id: true },
  });
  return !!outraMatricula;
}
