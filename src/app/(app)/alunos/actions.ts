"use server";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { verifyStaff, verifyRole } from "@/lib/dal";
import { auditLog } from "@/lib/audit";

type State = { error: string } | undefined;

export async function salvarAluno(id: string | null, _prev: State, formData: FormData): Promise<State> {
  const session = await verifyStaff();

  const fullName         = String(formData.get("fullName") ?? "").trim();
  const warName          = String(formData.get("warName") ?? "").trim();
  const courseId         = String(formData.get("courseId") ?? "").trim();
  const platoonId        = String(formData.get("platoonId") ?? "").trim() || null;
  const courseNumber     = String(formData.get("courseNumber") ?? "").trim();
  const cpf              = String(formData.get("cpf") ?? "").trim() || null;
  const rg               = String(formData.get("rg") ?? "").trim();
  const functionalNumber = String(formData.get("functionalNumber") ?? "").trim() || null;
  const email            = String(formData.get("email") ?? "").trim().toLowerCase() || null;
  const status           = String(formData.get("status") ?? "ATIVO");

  if (!fullName || !warName || !courseId || !courseNumber || !rg) {
    return { error: "Preencha todos os campos obrigatórios." };
  }
  if (!cpf) return { error: "CPF é obrigatório (usado como login do aluno)." };
  if (!functionalNumber) return { error: "Número Funcional é obrigatório (usado como senha inicial do aluno)." };

  const course = await prisma.course.findUnique({ where: { id: courseId } });
  if (!course) return { error: "Curso selecionado não encontrado." };

  function rankDeAluno(courseName: string): string {
    const u = courseName.toUpperCase();
    if (u.startsWith("CFO")) return "AL OF PM";
    if (u.startsWith("CFSD")) return "AL SD PM";
    if (u.startsWith("CHS")) return "AL SGT PM";
    return "AL PM";
  }
  const rank = rankDeAluno(course.name);

  try {
    if (id) {
      await prisma.student.update({
        where: { id },
        data: { fullName, warName, courseId, courseNumber, platoonId, cpf, rg, functionalNumber, email, status },
      });
      await auditLog(session.userId, "UPDATE", "Student", id, fullName);
    } else {
      // Cria conta de usuário para o aluno (CPF = login, nº funcional = senha inicial)
      const emailAluno = email || `${(cpf ?? rg).replace(/[.\-\s]/g, "")}@aluno.sigecone.mil.br`;
      const passwordHash = await bcrypt.hash(functionalNumber!, 10);
      const userAluno = await prisma.user.create({
        data: {
          fullName,
          warName,
          rank,
          rg,
          cpf,
          functionalNumber: functionalNumber!,
          email: emailAluno,
          passwordHash,
          role: "ALUNO",
          escola: "TODAS",
          active: true,
        },
      });
      const s = await prisma.student.create({
        data: { fullName, warName, courseId, courseNumber, platoonId, cpf, rg, functionalNumber, email, status, userId: userAluno.id },
      });
      await auditLog(session.userId, "CREATE", "Student", s.id, fullName);
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "";
    if (msg.includes("Unique")) return { error: "CPF, RG ou Número Funcional já cadastrado." };
    return { error: "Erro ao salvar aluno." };
  }
  redirect("/alunos");
}

type ResetState = { error?: string; success?: string } | undefined;

export async function resetarSenhaAluno(studentId: string, _prev: ResetState, _fd: FormData): Promise<ResetState> {
  await verifyRole("ADMINISTRADOR", "COMANDANTE_ESFAP", "COMANDANTE_ESFO");
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    include: { user: true },
  });
  if (!student) return { error: "Aluno não encontrado." };
  if (!student.userId || !student.user) return { error: "Este aluno não possui conta de acesso cadastrada." };
  if (!student.functionalNumber) return { error: "Número Funcional não cadastrado. Não é possível redefinir a senha automaticamente." };
  await prisma.user.update({
    where: { id: student.userId },
    data: { passwordHash: await bcrypt.hash(student.functionalNumber, 10) },
  });
  return { success: `Senha de ${student.warName} redefinida para o Número Funcional.` };
}
