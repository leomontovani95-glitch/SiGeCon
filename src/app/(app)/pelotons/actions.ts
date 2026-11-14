"use server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { verifyRole, escolaNoEscopo } from "@/lib/dal";
import { auditLog } from "@/lib/audit";
import { logger } from "@/lib/logger";

type State = { error: string } | undefined;

const ERRO_OUTRA_ESCOLA = "Sem permissão para alterar pelotão de curso de outra escola.";

export async function salvarPelotao(id: string | null, _prev: State, formData: FormData): Promise<State> {
  const session = await verifyRole("ADMINISTRADOR", "PROTOCOLO");
  const name = String(formData.get("name") ?? "").trim();
  const courseId = String(formData.get("courseId") ?? "").trim();
  const active = formData.get("active") === "true";
  if (!name || !courseId) return { error: "Nome e curso são obrigatórios." };

  // Escopo de escola: tanto o curso de destino quanto (na edição) o curso atual
  // do pelotão precisam ser da escola do usuário.
  const curso = await prisma.course.findUnique({ where: { id: courseId }, select: { school: true } });
  if (!curso) return { error: "Curso não encontrado." };
  if (!escolaNoEscopo(session, curso.school)) return { error: ERRO_OUTRA_ESCOLA };
  if (id) {
    const atual = await prisma.platoon.findUnique({ where: { id }, select: { course: { select: { school: true } } } });
    if (!atual) return { error: "Pelotão não encontrado." };
    if (!escolaNoEscopo(session, atual.course.school)) return { error: ERRO_OUTRA_ESCOLA };
  }

  try {
    if (id) {
      await prisma.platoon.update({ where: { id }, data: { name, courseId, active } });
      await auditLog(session.userId, "UPDATE", "Platoon", id, name);
    } else {
      const p = await prisma.platoon.create({ data: { name, courseId, active } });
      await auditLog(session.userId, "CREATE", "Platoon", p.id, name);
    }
  } catch (e) {
    logger.error("pelotons: salvar pelotão", e);
    return { error: "Erro ao salvar pelotão." };
  }
  redirect("/pelotons");
}
