"use server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { verifyRole } from "@/lib/dal";
import { auditLog } from "@/lib/audit";
import { logger } from "@/lib/logger";
import { CURSOS_POR_ESCOLA, ANOS_LETIVOS, gerarSiglaCurso, type BaseCurso } from "@/lib/cursos";

type State = { error: string } | undefined;

export async function adicionarPelotaoNoCurso(courseId: string, _prev: State, formData: FormData): Promise<State> {
  const session = await verifyRole("ADMINISTRADOR", "PROTOCOLO", "COMANDANTE_ESFAP", "COMANDANTE_ESFO", "CHEFE_DIVISAO_ACADEMICA", "SUBCOMANDANTE_ESFAP", "SUBCOMANDANTE_ESFO", "OFICIAL_ESFAP", "OFICIAL_ESFO");
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Nome do pelotão é obrigatório." };
  try {
    const p = await prisma.platoon.create({ data: { courseId, name, active: true } });
    await auditLog(session.userId, "CREATE", "Platoon", p.id, name);
  } catch (e) {
    logger.error("cursos: adicionar pelotão", e);
    return { error: "Erro ao adicionar pelotão." };
  }
  redirect(`/cursos/${courseId}/editar`);
}

export async function excluirPelotaoNoCurso(courseId: string, platoonId: string, _prev: State, _fd: FormData): Promise<State> {
  const session = await verifyRole("ADMINISTRADOR", "PROTOCOLO", "COMANDANTE_ESFAP", "COMANDANTE_ESFO", "CHEFE_DIVISAO_ACADEMICA", "SUBCOMANDANTE_ESFAP", "SUBCOMANDANTE_ESFO", "OFICIAL_ESFAP", "OFICIAL_ESFO");
  const pelotao = await prisma.platoon.findUnique({
    where: { id: platoonId },
    include: { _count: { select: { students: true } } },
  });
  if (!pelotao) return { error: "Pelotão não encontrado." };
  if (pelotao._count.students > 0) return { error: `Não é possível excluir: pelotão possui ${pelotao._count.students} aluno(s).` };
  try {
    await prisma.platoon.delete({ where: { id: platoonId } });
    await auditLog(session.userId, "DELETE", "Platoon", platoonId, pelotao.name);
  } catch (e) {
    logger.error("cursos: excluir pelotão", e);
    return { error: "Erro ao excluir pelotão." };
  }
  redirect(`/cursos/${courseId}/editar`);
}

export async function excluirCurso(id: string, _prev: { error: string } | undefined, _fd: FormData): Promise<{ error: string } | undefined> {
  const session = await verifyRole("ADMINISTRADOR", "PROTOCOLO", "COMANDANTE_ESFAP", "COMANDANTE_ESFO", "CHEFE_DIVISAO_ACADEMICA", "SUBCOMANDANTE_ESFAP", "SUBCOMANDANTE_ESFO", "OFICIAL_ESFAP", "OFICIAL_ESFO");
  const curso = await prisma.course.findUnique({
    where: { id },
    include: { _count: { select: { students: true, communications: true } } },
  });
  if (!curso) return { error: "Curso não encontrado." };
  if (curso._count.students > 0) return { error: `Não é possível excluir: curso possui ${curso._count.students} aluno(s).` };
  if (curso._count.communications > 0) return { error: `Não é possível excluir: curso possui ${curso._count.communications} comunicação(ões).` };
  try {
    await prisma.platoon.deleteMany({ where: { courseId: id } });
    await prisma.course.delete({ where: { id } });
    await auditLog(session.userId, "DELETE", "Course", id, curso.name);
  } catch (e) {
    logger.error("cursos: excluir curso", e);
    return { error: "Erro ao excluir curso." };
  }
  redirect("/cursos");
}

export async function salvarCurso(id: string | null, _prev: State, formData: FormData): Promise<State> {
  const session = await verifyRole("ADMINISTRADOR", "PROTOCOLO", "COMANDANTE_ESFAP", "COMANDANTE_ESFO", "CHEFE_DIVISAO_ACADEMICA", "SUBCOMANDANTE_ESFAP", "SUBCOMANDANTE_ESFO", "OFICIAL_ESFAP", "OFICIAL_ESFO");
  const description = String(formData.get("description") ?? "").trim();
  const active = formData.get("active") === "true";

  // ── Edição: identidade travada, altera apenas descrição/situação. ──
  if (id) {
    try {
      const atual = await prisma.course.findUnique({ where: { id }, select: { active: true, name: true } });
      if (!atual) return { error: "Curso não encontrado." };
      await prisma.course.update({ where: { id }, data: { description, active } });
      // Ao inativar o curso, os alunos ainda ATIVOS são automaticamente inativados.
      // Eles permanecem cadastrados e podem ser transferidos/ascender de curso.
      if (atual.active && !active) {
        const r = await prisma.student.updateMany({
          where: { courseId: id, status: "ATIVO" },
          data: { status: "INATIVO" },
        });
        if (r.count > 0) {
          await auditLog(session.userId, "UPDATE", "Course", id, `${atual.name} — ${r.count} aluno(s) inativado(s) ao inativar o curso`);
        }
      }
      await auditLog(session.userId, "UPDATE", "Course", id, atual.name);
    } catch (e) {
      logger.error("cursos: editar curso", e);
      return { error: "Erro ao salvar o curso." };
    }
    redirect("/cursos");
  }

  // ── Criação: sigla gerada a partir dos campos estruturados. ──
  const school = String(formData.get("school") ?? "").trim();
  const baseCourse = String(formData.get("baseCourse") ?? "").trim();
  const academicYear = formData.get("academicYear") ? Number(formData.get("academicYear")) : null;
  const startYear = formData.get("startYear") ? Number(formData.get("startYear")) : null;
  const remnant = formData.get("remnant") === "true";
  const platoonCount = Math.max(0, parseInt(String(formData.get("platoonCount") ?? "0")) || 0);

  if (school !== "ESFO" && school !== "ESFAP") return { error: "Selecione uma escola válida." };
  const basesValidas = CURSOS_POR_ESCOLA[school].map((c) => c.value as string);
  if (!basesValidas.includes(baseCourse)) return { error: "Selecione um curso válido para a escola." };
  if (school === "ESFO" && !ANOS_LETIVOS.includes(academicYear as 1 | 2 | 3)) {
    return { error: "Selecione o ano letivo do curso." };
  }
  if (!startYear || startYear < 2000 || startYear > 2100) return { error: "Informe um ano de início válido." };

  const name = gerarSiglaCurso({ baseCourse: baseCourse as BaseCurso, academicYear, startYear, remnant });

  try {
    // Bloqueia curso idêntico (mesma sigla E mesmo ano de início), ativo ou não.
    // Siglas iguais com anos de início diferentes são permitidas.
    const existente = await prisma.course.findFirst({ where: { name, year: startYear }, select: { id: true } });
    if (existente) return { error: `Já existe um curso "${name}" com início em ${startYear}.` };

    const c = await prisma.course.create({
      data: { name, acronym: baseCourse, school, year: startYear, description, active },
    });
    for (let i = 1; i <= platoonCount; i++) {
      await prisma.platoon.create({ data: { courseId: c.id, name: `${i}º Pelotão`, active: true } });
    }
    await auditLog(session.userId, "CREATE", "Course", c.id, `${name} (${platoonCount} pelotão(ões))`);
  } catch (e) {
    logger.error("cursos: criar curso", e);
    return { error: "Erro ao salvar o curso." };
  }
  redirect("/cursos");
}
