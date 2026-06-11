"use server";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { verifyStaff, verifyRole } from "@/lib/dal";
import { auditLog } from "@/lib/audit";

type State = { error: string } | undefined;

function senhaInicial(functionalNumber: string, rg: string): string {
  return functionalNumber + rg.replace(/[^a-zA-Z0-9]/g, "");
}

function rankDeAluno(courseName: string): string {
  const u = courseName.toUpperCase();
  if (u.startsWith("CFO"))  return "AL OF PM";
  if (u.startsWith("CFSD")) return "AL SD PM";
  if (u.startsWith("CHS"))  return "AL SGT PM";
  return "AL PM";
}

export async function salvarAluno(id: string | null, _prev: State, formData: FormData): Promise<State> {
  const session = await verifyStaff();

  const fullName         = String(formData.get("fullName") ?? "").trim();
  const warName          = String(formData.get("warName") ?? "").trim();
  const courseId         = String(formData.get("courseId") ?? "").trim();
  const platoonId        = String(formData.get("platoonId") ?? "").trim() || null;
  const courseNumber     = String(formData.get("courseNumber") ?? "").trim();
  const rg               = String(formData.get("rg") ?? "").trim();
  const functionalNumber = String(formData.get("functionalNumber") ?? "").trim() || null;
  const status           = String(formData.get("status") ?? "ATIVO");

  if (!fullName || !warName || !courseId || !courseNumber || !rg) {
    return { error: "Preencha todos os campos obrigatórios." };
  }
  if (!functionalNumber) return { error: "Número Funcional é obrigatório (usado como login do aluno)." };

  const course = await prisma.course.findUnique({ where: { id: courseId } });
  if (!course) return { error: "Curso selecionado não encontrado." };

  const rank = rankDeAluno(course.name);

  try {
    if (id) {
      const existing = await prisma.student.findUnique({ where: { id }, select: { userId: true } });
      await prisma.student.update({
        where: { id },
        data: { fullName, warName, courseId, courseNumber, platoonId, rg, functionalNumber, status },
      });
      if (existing?.userId) {
        try {
          await prisma.user.update({
            where: { id: existing.userId },
            data: { fullName, warName, rank, rg, ...(functionalNumber ? { functionalNumber } : {}) },
          });
        } catch { /* silently ignore unique constraint violations */ }
      } else if (functionalNumber) {
        try {
          const passwordHash = await bcrypt.hash(senhaInicial(functionalNumber, rg), 10);
          const userAluno = await prisma.user.create({
            data: { fullName, warName, rank, rg, functionalNumber, passwordHash, role: "ALUNO", escola: "TODAS", active: true, mustChangePassword: true },
          });
          await prisma.student.update({ where: { id }, data: { userId: userAluno.id } });
        } catch { /* conta já existe — admin pode usar o botão explícito */ }
      }
      await auditLog(session.userId, "UPDATE", "Student", id, fullName);
    } else {
      const passwordHash = await bcrypt.hash(senhaInicial(functionalNumber, rg), 10);
      const userAluno = await prisma.user.create({
        data: {
          fullName,
          warName,
          rank,
          rg,
          functionalNumber,
          passwordHash,
          role: "ALUNO",
          escola: "TODAS",
          active: true,
          mustChangePassword: true,
        },
      });
      const s = await prisma.student.create({
        data: { fullName, warName, courseId, courseNumber, platoonId, rg, functionalNumber, status, userId: userAluno.id },
      });
      await auditLog(session.userId, "CREATE", "Student", s.id, fullName);
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "";
    if (msg.includes("Unique") || msg.includes("unique")) return { error: "RG ou Número Funcional já cadastrado." };
    return { error: "Erro ao salvar aluno." };
  }
  redirect("/alunos");
}

type ResetState = { error?: string; success?: string } | undefined;

export async function criarContaAluno(studentId: string, _prev: ResetState, _fd: FormData): Promise<ResetState> {
  await verifyRole("ADMINISTRADOR", "CHEFE_DIVISAO_ACADEMICA", "COMANDANTE_ESFAP", "COMANDANTE_ESFO");
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    include: { user: true, course: true },
  });
  if (!student) return { error: "Aluno não encontrado." };
  if (student.userId) return { error: "Este aluno já possui conta de acesso cadastrada." };
  if (!student.functionalNumber) return { error: "Cadastre o Número Funcional antes de criar a conta de acesso." };

  const passwordHash = await bcrypt.hash(senhaInicial(student.functionalNumber, student.rg), 10);
  try {
    const userAluno = await prisma.user.create({
      data: {
        fullName:          student.fullName,
        warName:           student.warName,
        rank:              rankDeAluno(student.course.name),
        rg:                student.rg,
        functionalNumber:  student.functionalNumber,
        passwordHash,
        role:              "ALUNO",
        escola:            "TODAS",
        active:            true,
        mustChangePassword: true,
      },
    });
    await prisma.student.update({ where: { id: studentId }, data: { userId: userAluno.id } });
    return { success: `Conta criada para ${student.warName}. Senha inicial: Nº Funcional + RG sem pontuação. O aluno deverá alterá-la no primeiro acesso.` };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "";
    if (msg.toLowerCase().includes("unique")) {
      const existingUser = await prisma.user.findFirst({
        where: { functionalNumber: student.functionalNumber, role: "ALUNO" },
        include: { student: { select: { id: true } } },
      });
      if (existingUser && !existingUser.student) {
        await prisma.student.update({ where: { id: studentId }, data: { userId: existingUser.id } });
        return { success: `Conta existente vinculada a ${student.warName}.` };
      }
      return { error: "Número Funcional ou RG já está em uso por outro cadastro." };
    }
    return { error: "Erro ao criar conta de acesso." };
  }
}

export async function resetarSenhaAluno(studentId: string, _prev: ResetState, _fd: FormData): Promise<ResetState> {
  await verifyRole("ADMINISTRADOR", "COMANDANTE_ESFAP", "COMANDANTE_ESFO");
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    include: { user: true },
  });
  if (!student) return { error: "Aluno não encontrado." };
  if (!student.userId || !student.user) return { error: "Este aluno não possui conta de acesso cadastrada." };
  if (!student.functionalNumber) return { error: "Número Funcional não cadastrado. Não é possível redefinir a senha automaticamente." };
  const novaSenha = senhaInicial(student.functionalNumber, student.rg);
  await prisma.user.update({
    where: { id: student.userId },
    data: { passwordHash: await bcrypt.hash(novaSenha, 10), mustChangePassword: true },
  });
  return { success: `Senha de ${student.warName} redefinida para Nº Funcional + RG sem pontuação.` };
}
