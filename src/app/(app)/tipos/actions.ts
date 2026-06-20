"use server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { verifyRole } from "@/lib/dal";
import { auditLog } from "@/lib/audit";
import { logger } from "@/lib/logger";
import { ehTipoSistema } from "@/lib/tiposComunicacao";

type State = { error: string } | undefined;

const TIPO_ROLES = ["ADMINISTRADOR", "COMANDANTE_ESFAP", "COMANDANTE_ESFO", "CHEFE_DIVISAO_ACADEMICA", "SUBCOMANDANTE_ESFAP", "SUBCOMANDANTE_ESFO", "OFICIAL_ESFAP", "OFICIAL_ESFO"] as const;

export async function excluirTipo(id: string, _prev: State, _formData: FormData): Promise<State> {
  const session = await verifyRole(...TIPO_ROLES);
  const tipo = await prisma.communicationType.findUnique({
    where: { id },
    select: { name: true, _count: { select: { communications: true } } },
  });
  if (!tipo) return { error: "Tipo não encontrado." };
  // Tipo de sistema: o nome é referenciado por código em vários fluxos; excluir
  // quebraria cadastro de CPI/TD e o caderno. Pode ser editado/inativado, não excluído.
  if (ehTipoSistema(tipo.name)) {
    return { error: `"${tipo.name}" é um tipo padrão do sistema e não pode ser excluído. Se necessário, edite a pontuação ou defina como inativo.` };
  }
  // Não exclui tipo em uso: comunicações o referenciam (FK). Orienta a inativar.
  if (tipo._count.communications > 0) {
    return { error: `Não é possível excluir "${tipo.name}": há ${tipo._count.communications} comunicação(ões) usando este tipo. Para descontinuá-lo, edite e defina como inativo.` };
  }
  try {
    await prisma.communicationType.delete({ where: { id } });
    await auditLog(session.userId, "DELETE", "CommunicationType", id, tipo.name);
  } catch (e) {
    logger.error("tipos: excluir tipo", e);
    return { error: "Não foi possível excluir o tipo." };
  }
  redirect("/tipos");
}

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
  } catch (e) {
    logger.error("tipos: salvar tipo", e);
    return { error: "Erro ao salvar. Verifique se o nome já existe." };
  }
  redirect("/tipos");
}
