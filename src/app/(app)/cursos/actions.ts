"use server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { verifyRole } from "@/lib/dal";
import { auditLog } from "@/lib/audit";

export async function excluirCurso(id: string, _prev: { error: string } | undefined, _fd: FormData): Promise<{ error: string } | undefined> {
  const session = await verifyRole("ADMINISTRADOR", "PROTOCOLO", "COMANDANTE_ESFAP", "COMANDANTE_ESFO");
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
  } catch {
    return { error: "Erro ao excluir curso." };
  }
  redirect("/cursos");
}

type State = { error: string } | undefined;

export async function salvarCurso(id: string | null, _prev: State, formData: FormData): Promise<State> {
  const session = await verifyRole("ADMINISTRADOR", "PROTOCOLO", "COMANDANTE_ESFAP", "COMANDANTE_ESFO");
  const name = String(formData.get("name") ?? "").trim();
  const acronym = String(formData.get("acronym") ?? "").trim();
  const school = String(formData.get("school") ?? "").trim() || null;
  const year = formData.get("year") ? Number(formData.get("year")) : null;
  const description = String(formData.get("description") ?? "").trim();
  const active = formData.get("active") === "true";

  const platoonCount = id ? 0 : Math.max(0, parseInt(String(formData.get("platoonCount") ?? "0")) || 0);
  if (!name || !acronym || !school) return { error: "Nome, sigla e escola são obrigatórios." };

  try {
    if (id) {
      await prisma.course.update({ where: { id }, data: { name, acronym, school, year, description, active } });
      await auditLog(session.userId, "UPDATE", "Course", id, name);
    } else {
      const c = await prisma.course.create({ data: { name, acronym, school, year, description, active } });
      // Cria pelotões automaticamente
      for (let i = 1; i <= platoonCount; i++) {
        await prisma.platoon.create({ data: { courseId: c.id, name: `${i}º Pelotão`, active: true } });
      }
      await auditLog(session.userId, "CREATE", "Course", c.id, `${name} (${platoonCount} pelotão(ões))`);
    }
  } catch {
    return { error: "Erro ao salvar. Verifique se o nome já existe." };
  }
  redirect("/cursos");
}
