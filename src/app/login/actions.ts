"use server";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { createSession } from "@/lib/session";
import { verificarLimite, registrarFalha, limparTentativas } from "@/lib/rate-limit";

type LoginState = { error: string } | undefined;

export async function login(
  _prev: LoginState,
  formData: FormData
): Promise<LoginState> {
  const input = String(formData.get("functionalNumber") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!input || !password) {
    return { error: "Preencha o Número Funcional e a senha." };
  }

  // Proteção contra força bruta: limita tentativas por conta (Número Funcional).
  // A chave é a conta, não o IP, para não bloquear toda a rede da PMES (NAT com
  // IP único) quando um usuário erra a senha.
  const chaveLimite = `login:${input.toLowerCase()}`;
  const limite = verificarLimite(chaveLimite);
  if (!limite.permitido) {
    const minutos = Math.max(1, Math.ceil(limite.esperarMs / 60000));
    return { error: `Muitas tentativas de login. Tente novamente em ${minutos} minuto(s).` };
  }

  const user = await prisma.user.findFirst({
    where: { functionalNumber: input },
  });

  if (!user || !user.active) {
    registrarFalha(chaveLimite);
    return { error: "Número Funcional ou senha inválidos." };
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    registrarFalha(chaveLimite);
    return { error: "Número Funcional ou senha inválidos." };
  }

  limparTentativas(chaveLimite);
  await createSession({
    userId: user.id,
    role: user.role,
    additionalRoles: user.additionalRoles ?? "",
    email: user.email ?? "",
    warName: user.warName,
    escola: user.escola ?? "TODAS",
    mustChangePassword: user.mustChangePassword,
    expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000),
  });

  if (user.mustChangePassword) redirect("/perfil?mustChange=1");
  redirect("/dashboard");
}
