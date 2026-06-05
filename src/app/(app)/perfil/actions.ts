"use server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { verifySession } from "@/lib/dal";
import { createSession } from "@/lib/session";

type State = { error?: string; success?: string } | undefined;

export async function trocarSenha(_prev: State, formData: FormData): Promise<State> {
  const session = await verifySession();

  const senhaAtual   = String(formData.get("senhaAtual") ?? "");
  const novaSenha    = String(formData.get("novaSenha") ?? "");
  const confirmacao  = String(formData.get("confirmacao") ?? "");

  if (!senhaAtual || !novaSenha || !confirmacao) {
    return { error: "Preencha todos os campos." };
  }
  if (novaSenha.length < 6) {
    return { error: "A nova senha deve ter no mínimo 6 caracteres." };
  }
  if (novaSenha !== confirmacao) {
    return { error: "A nova senha e a confirmação não coincidem." };
  }

  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user) return { error: "Usuário não encontrado." };

  const valida = await bcrypt.compare(senhaAtual, user.passwordHash);
  if (!valida) return { error: "Senha atual incorreta." };

  await prisma.user.update({
    where: { id: session.userId },
    data: { passwordHash: await bcrypt.hash(novaSenha, 10), mustChangePassword: false },
  });

  // Atualiza o cookie de sessão para limpar o flag de troca obrigatória
  await createSession({
    userId: session.userId,
    role: session.role,
    email: session.email,
    warName: session.warName,
    escola: session.escola,
    mustChangePassword: false,
    expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000),
  });

  return { success: "Senha alterada com sucesso." };
}
