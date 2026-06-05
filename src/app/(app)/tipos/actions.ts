"use server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { verifyRole } from "@/lib/dal";
import { auditLog } from "@/lib/audit";

type State = { error: string } | undefined;

export async function salvarTipo(id: string | null, _prev: State, formData: FormData): Promise<State> {
  const session = await verifyRole("ADMINISTRADOR", "COMANDANTE_ESFAP", "COMANDANTE_ESFO", "CHEFE_DIVISAO_ACADEMICA", "SUBCOMANDANTE_ESFAP", "SUBCOMANDANTE_ESFO", "OFICIAL_ESFAP", "OFICIAL_ESFO");
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;
  const score = Number(formData.get("score") ?? 0);
  const scoreNature = String(formData.get("scoreNature") ?? "DESFAVORAVEL");
  const active = formData.get("active") === "true";
  if (!name) return { error: "Nome é obrigatório." };
  try {
    if (id) {
      await prisma.communicationType.update({ where: { id }, data: { name, description, score, scoreNature, active } });
      await auditLog(session.userId, "UPDATE", "CommunicationType", id, name);
    } else {
      const t = await prisma.communicationType.create({ data: { name, description, score, scoreNature, active } });
      await auditLog(session.userId, "CREATE", "CommunicationType", t.id, name);
    }
  } catch {
    return { error: "Erro ao salvar. Verifique se o nome já existe." };
  }
  redirect("/tipos");
}
