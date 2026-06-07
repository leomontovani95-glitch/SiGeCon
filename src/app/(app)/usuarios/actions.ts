"use server";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { verifyRole } from "@/lib/dal";
import { auditLog } from "@/lib/audit";

type State = { error: string } | undefined;

export async function salvarUsuario(id: string | null, _prev: State, formData: FormData): Promise<State> {
  const session = await verifyRole(
    "ADMINISTRADOR", "COMANDANTE_ESFAP", "COMANDANTE_ESFO",
    "SUBCOMANDANTE_ESFAP", "SUBCOMANDANTE_ESFO", "OFICIAL_ESFAP", "OFICIAL_ESFO",
  );

  const fullName        = String(formData.get("fullName")        ?? "").trim();
  const warName         = String(formData.get("warName")         ?? "").trim();
  const rank            = String(formData.get("rank")            ?? "").trim();
  const rg              = String(formData.get("rg")              ?? "").trim();
  const cpf             = String(formData.get("cpf")             ?? "").trim() || null;
  const escola          = String(formData.get("escola")          ?? "TODAS").trim();
  const functionalNumber= String(formData.get("functionalNumber")?? "").trim();
  const email           = String(formData.get("email")           ?? "").trim().toLowerCase() || null;
  const password        = String(formData.get("password")        ?? "");
  const role            = String(formData.get("role")            ?? "PROTOCOLO");
  const additionalRoles = (formData.getAll("additionalRoles") as string[])
    .filter((r) => r && r !== role)
    .join(",");
  const active = formData.get("active") === "true";

  if (!fullName || !warName || !rank || !rg || !functionalNumber || !cpf) {
    return { error: "Preencha todos os campos obrigatórios (incluindo CPF)." };
  }
  if (password && password.length < 6) {
    return { error: "A senha deve ter no mínimo 6 caracteres." };
  }

  // Campos base explicitamente tipados — evita PrismaClientValidationError com Record<string, unknown>
  const baseFields = {
    fullName,
    warName,
    rank,
    rg,
    cpf,
    escola,
    functionalNumber,
    email,
    role,
    additionalRoles,
    active,
  };

  const senhaEfetiva = password || (!id ? functionalNumber : "");

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
        },
      });
      await auditLog(session.userId, "CREATE", "User", user.id, `Criado: ${fullName}`);
    }
  } catch (e: unknown) {
    // Loga o erro completo no servidor para diagnóstico
    console.error("[salvarUsuario] erro:", e);

    const code = (e as { code?: string })?.code;
    const msg  = e instanceof Error ? e.message : String(e);

    if (code === "P2002" || msg.toLowerCase().includes("unique")) {
      return { error: "E-mail, RG, CPF ou número funcional já cadastrado em outro usuário." };
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
  await verifyRole(
    "ADMINISTRADOR", "COMANDANTE_ESFAP", "COMANDANTE_ESFO",
    "SUBCOMANDANTE_ESFAP", "SUBCOMANDANTE_ESFO", "OFICIAL_ESFAP", "OFICIAL_ESFO",
  );
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return { error: "Usuário não encontrado." };
  if (!user.functionalNumber) return { error: "Número Funcional não cadastrado. Não é possível redefinir a senha automaticamente." };
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: await bcrypt.hash(user.functionalNumber, 10) },
  });
  return { success: `Senha redefinida para o Número Funcional (${user.functionalNumber}).` };
}

export async function excluirUsuario(id: string, _prev: { error: string } | undefined, _fd: FormData): Promise<{ error: string } | undefined> {
  const session = await verifyRole(
    "ADMINISTRADOR", "COMANDANTE_ESFAP", "COMANDANTE_ESFO",
    "SUBCOMANDANTE_ESFAP", "SUBCOMANDANTE_ESFO", "OFICIAL_ESFAP", "OFICIAL_ESFO",
  );
  if (session.userId === id) return { error: "Não é possível excluir o próprio usuário." };
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) return { error: "Usuário não encontrado." };
  if (user.role === "ADMINISTRADOR") {
    if (session.role !== "ADMINISTRADOR") return { error: "Apenas o Administrador pode excluir outros administradores." };
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
