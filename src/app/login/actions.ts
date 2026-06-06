"use server";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { createSession } from "@/lib/session";

type LoginState = { error: string } | undefined;

export async function login(
  _prev: LoginState,
  formData: FormData
): Promise<LoginState> {
  const input = String(formData.get("cpf") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!input || !password) {
    return { error: "Preencha CPF e senha." };
  }

  // Aceita CPF (novo padrão) ou e-mail (retrocompatibilidade com contas existentes)
  const user = await prisma.user.findFirst({
    where: { OR: [{ cpf: input }, { email: input }] },
  });

  if (!user || !user.active) {
    return { error: "CPF ou senha inválidos." };
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    return { error: "CPF ou senha inválidos." };
  }

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
