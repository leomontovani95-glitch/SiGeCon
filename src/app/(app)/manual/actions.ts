"use server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { verifyRole } from "@/lib/dal";
import { auditLog } from "@/lib/audit";
import { logger } from "@/lib/logger";

type State = { error: string } | undefined;

export async function salvarRegra(id: string | null, _prev: State, formData: FormData): Promise<State> {
  const session = await verifyRole("ADMINISTRADOR");
  const article = String(formData.get("article") ?? "").trim();
  const item = String(formData.get("item") ?? "").trim() || null;
  const letter = String(formData.get("letter") ?? "").trim() || null;
  const description = String(formData.get("description") ?? "").trim();
  const defaultCommunicationType = String(formData.get("defaultCommunicationType") ?? "").trim() || null;
  const defaultScore = formData.get("defaultScore") ? Number(formData.get("defaultScore")) : null;
  const active = formData.get("active") === "true";

  if (!article || !description) return { error: "Artigo e descrição são obrigatórios." };

  const theme = String(formData.get("theme") ?? "").trim() || null;
  const data = { article, item, letter, description, theme, defaultCommunicationType, defaultScore, active };
  try {
    if (id) {
      await prisma.manualRule.update({ where: { id }, data });
      await auditLog(session.userId, "UPDATE", "ManualRule", id, description);
    } else {
      const r = await prisma.manualRule.create({ data });
      await auditLog(session.userId, "CREATE", "ManualRule", r.id, description);
    }
  } catch (e) {
    logger.error("manual: salvar dispositivo", e);
    return { error: "Erro ao salvar dispositivo." };
  }
  redirect("/manual");
}
