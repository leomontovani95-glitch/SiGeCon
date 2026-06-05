"use server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { verifyRole } from "@/lib/dal";
import { auditLog } from "@/lib/audit";

type State = { error: string } | undefined;

export async function salvarPelotao(id: string | null, _prev: State, formData: FormData): Promise<State> {
  const session = await verifyRole("ADMINISTRADOR", "PROTOCOLO");
  const name = String(formData.get("name") ?? "").trim();
  const courseId = String(formData.get("courseId") ?? "").trim();
  const active = formData.get("active") === "true";
  if (!name || !courseId) return { error: "Nome e curso são obrigatórios." };
  try {
    if (id) {
      await prisma.platoon.update({ where: { id }, data: { name, courseId, active } });
      await auditLog(session.userId, "UPDATE", "Platoon", id, name);
    } else {
      const p = await prisma.platoon.create({ data: { name, courseId, active } });
      await auditLog(session.userId, "CREATE", "Platoon", p.id, name);
    }
  } catch {
    return { error: "Erro ao salvar pelotão." };
  }
  redirect("/pelotons");
}
