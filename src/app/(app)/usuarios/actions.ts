"use server";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { verifyRole, canManageUserRole, USER_MANAGERS } from "@/lib/dal";
import { auditLog } from "@/lib/audit";

type State = { error: string } | undefined;

function senhaInicial(functionalNumber: string, rg: string): string {
  return functionalNumber + rg.replace(/[^a-zA-Z0-9]/g, "");
}

export async function salvarUsuario(id: string | null, _prev: State, formData: FormData): Promise<State> {
  const session = await verifyRole(...USER_MANAGERS);

  const fullName         = String(formData.get("fullName")         ?? "").trim();
  const warName          = String(formData.get("warName")          ?? "").trim();
  const rank             = String(formData.get("rank")             ?? "").trim();
  const rg               = String(formData.get("rg")              ?? "").trim();
  const escola           = String(formData.get("escola")           ?? "TODAS").trim();
  const functionalNumber = String(formData.get("functionalNumber") ?? "").trim();
  const password         = String(formData.get("password")         ?? "");
  const role             = String(formData.get("role")             ?? "PROTOCOLO");
  // Filtra additionalRoles para aceitar apenas funções que o ator pode atribuir
  const additionalRoles  = (formData.getAll("additionalRoles") as string[])
    .filter((r) => r && r !== role && canManageUserRole(session.role, r))
    .join(",");
  const active = formData.get("active") === "true";

  // Verifica se o ator pode atribuir a função principal
  if (!canManageUserRole(session.role, role)) {
    return { error: "Você não tem permissão para atribuir essa função." };
  }
  // Se for edição, verifica se o ator pode gerir a função atual do usuário
  if (id) {
    const target = await prisma.user.findUnique({ where: { id }, select: { role: true } });
    if (!target) return { error: "Usuário não encontrado." };
    if (!canManageUserRole(session.role, target.role)) {
      return { error: "Você não tem permissão para editar este usuário." };
    }
  }

  if (!fullName || !warName || !rank || !rg || !functionalNumber) {
    return { error: "Preencha todos os campos obrigatórios." };
  }
  if (password && password.length < 6) {
    return { error: "A senha deve ter no mínimo 6 caracteres." };
  }

  const baseFields = {
    fullName, warName, rank, rg, escola, functionalNumber, role, additionalRoles, active,
  };

  const senhaEfetiva = password || (!id ? senhaInicial(functionalNumber, rg) : "");

  try {
    if (id) {
      await prisma.user.update({
        where: { id },
        data: senhaEfetiva
          ? { ...baseFields, passwordHash: await bcrypt.hash(senhaEfetiva, 10) }
          : baseFields,
      });
      await auditLog(session.userId, "UPDATE", "User", id, `Atualizado: ${fullName}`);
    } else {
      const user = await prisma.user.create({
        data: {
          ...baseFields,
          passwordHash: await bcrypt.hash(senhaEfetiva, 10),
          mustChangePassword: true,
        },
      });
      await auditLog(session.userId, "CREATE", "User", user.id, `Criado: ${fullName}`);
    }
  } catch (e: unknown) {
    console.error("[salvarUsuario] erro:", e);
    const code = (e as { code?: string })?.code;
    const msg  = e instanceof Error ? e.message : String(e);
    if (code === "P2002" || msg.toLowerCase().includes("unique")) {
      return { error: "RG ou Número Funcional já cadastrado em outro usuário." };
    }
    if (code === "P2025") {
      return { error: "Usuário não encontrado. Tente recarregar a página." };
    }
    if (code === "P2003") {
      return { error: "Operação não permitida: há registros vinculados a este usuário." };
    }
    return { error: "Erro ao salvar. Verifique os dados e tente novamente." };
  }

  redirect("/usuarios");
}

type ResetState = { error?: string; success?: string } | undefined;

export async function resetarSenha(userId: string, _prev: ResetState, _fd: FormData): Promise<ResetState> {
  const session = await verifyRole(...USER_MANAGERS);
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return { error: "Usuário não encontrado." };
  if (!canManageUserRole(session.role, user.role)) {
    return { error: "Você não tem permissão para redefinir a senha deste usuário." };
  }
  if (!user.functionalNumber) return { error: "Número Funcional não cadastrado. Não é possível redefinir a senha automaticamente." };
  const novaSenha = senhaInicial(user.functionalNumber, user.rg);
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: await bcrypt.hash(novaSenha, 10), mustChangePassword: true },
  });
  return { success: `Senha redefinida para: Nº Funcional + RG sem pontuação.` };
}

export async function excluirUsuario(id: string, _prev: { error: string } | undefined, _fd: FormData): Promise<{ error: string } | undefined> {
  const session = await verifyRole(...USER_MANAGERS);
  if (session.userId === id) return { error: "Não é possível excluir o próprio usuário." };
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) return { error: "Usuário não encontrado." };
  if (!canManageUserRole(session.role, user.role)) {
    return { error: "Você não tem permissão para excluir este usuário." };
  }
  if (user.role === "ADMINISTRADOR") {
    const adminCount = await prisma.user.count({ where: { role: "ADMINISTRADOR" } });
    if (adminCount <= 1) return { error: "Não é possível excluir o último administrador." };
  }
  try {
    await prisma.user.delete({ where: { id } });
    await auditLog(session.userId, "DELETE", "User", id, user.fullName);
  } catch {
    return { error: "Não é possível excluir: usuário possui registros vinculados." };
  }
  redirect("/usuarios");
}
