"use server";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { verifyStaff, verifyRole, VIEWERS_APM, getSchoolFilter } from "@/lib/dal";
import { auditLog } from "@/lib/audit";
import { logger } from "@/lib/logger";
import { formatCourseNumber } from "@/lib/utils";

type State = { error: string } | undefined;

// Perfis autorizados a mover alunos de curso (transferência remanescente e
// ascensão de curso): admin, Chefe da Divisão Acadêmica e os comandos das escolas.
const PODE_MOVER_CURSO = [
  "ADMINISTRADOR",
  "CHEFE_DIVISAO_ACADEMICA",
  "COMANDANTE_ESFAP",
  "COMANDANTE_ESFO",
  "SUBCOMANDANTE_ESFAP",
  "SUBCOMANDANTE_ESFO",
] as const;

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
  if (id === null && (VIEWERS_APM as string[]).includes(session.role)) {
    return { error: "Sem permissão para cadastrar novos alunos." };
  }

  const fullName         = String(formData.get("fullName") ?? "").trim();
  const warName          = String(formData.get("warName") ?? "").trim();
  const courseId         = String(formData.get("courseId") ?? "").trim();
  const platoonId        = String(formData.get("platoonId") ?? "").trim() || null;
  // Padroniza para dois dígitos: "1" -> "01", "10" -> "10".
  const courseNumberRaw  = String(formData.get("courseNumber") ?? "").trim();
  const courseNumber     = courseNumberRaw ? formatCourseNumber(courseNumberRaw) : "";
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
        } catch (e) { logger.warn("alunos: atualizar conta do aluno (best-effort)", e, { studentId: id }); }
      } else if (functionalNumber) {
        try {
          const passwordHash = await bcrypt.hash(senhaInicial(functionalNumber, rg), 10);
          const userAluno = await prisma.user.create({
            data: { fullName, warName, rank, rg, functionalNumber, passwordHash, role: "ALUNO", escola: "TODAS", active: true, mustChangePassword: true },
          });
          await prisma.student.update({ where: { id }, data: { userId: userAluno.id } });
        } catch (e) { logger.warn("alunos: criar conta do aluno (best-effort, conta pode já existir)", e, { studentId: id }); }
      }
      await auditLog(session.userId, "UPDATE", "Student", id, fullName);
    } else {
      // Verifica se a pessoa (mesmo RG ou NF) já possui conta de aluno. Se sim,
      // trata-se de ASCENSÃO/novo cadastro: reaproveita o login e cria uma nova
      // matrícula com histórico zerado (nota 10). A matrícula anterior é
      // preservada (acessível depois), porém desvinculada do login.
      const contaExistente = await prisma.user.findFirst({
        where: { role: "ALUNO", OR: [{ rg }, { functionalNumber }] },
        include: { student: { include: { course: true } } },
      });

      if (contaExistente) {
        const matriculaAtual = contaExistente.student;
        // Só é permitido recadastrar se a matrícula anterior estiver em curso INATIVO.
        if (matriculaAtual && matriculaAtual.course.active) {
          return {
            error: "Já existe um cadastro ativo para este RG/Número Funcional. " +
              "Inative o curso anterior antes de cadastrar a pessoa em um novo curso " +
              "(ou use a transferência de remanescente, se for o caso).",
          };
        }
        // Desvincula a matrícula anterior (libera o vínculo único com o login).
        if (matriculaAtual) {
          await prisma.student.update({ where: { id: matriculaAtual.id }, data: { userId: null } });
        }
        // Atualiza os dados da conta conforme o novo curso.
        await prisma.user.update({
          where: { id: contaExistente.id },
          data: { fullName, warName, rank, rg, ...(functionalNumber ? { functionalNumber } : {}) },
        });
        const s = await prisma.student.create({
          data: { fullName, warName, courseId, courseNumber, platoonId, rg, functionalNumber, status, userId: contaExistente.id },
        });
        await auditLog(session.userId, "CREATE", "Student", s.id, `${fullName} (novo cadastro / ascensão de curso)`);
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
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "";
    if (msg.includes("Unique") || msg.includes("unique")) return { error: "RG ou Número Funcional já cadastrado." };
    return { error: "Erro ao salvar aluno." };
  }
  redirect("/alunos");
}

// Valida o pelotão (opcional) escolhido para o curso de destino.
// Retorna o id do pelotão, null (sem pelotão) ou false (pelotão inválido).
async function validarPelotaoDoCurso(raw: FormDataEntryValue | null, courseId: string): Promise<string | null | false> {
  const platoonId = String(raw ?? "").trim();
  if (!platoonId) return null;
  const pel = await prisma.platoon.findUnique({ where: { id: platoonId }, select: { courseId: true } });
  if (!pel || pel.courseId !== courseId) return false;
  return platoonId;
}

// ── Transferência de curso (aluno remanescente) ─────────────────────────
// O número novo sempre recebe o sufixo "-R" (remanescente). O histórico e as
// comunicações (publicadas e em trâmite) permanecem inalterados — snapshot.
export async function transferirAluno(studentId: string, _prev: State, formData: FormData): Promise<State> {
  const session = await verifyRole(...PODE_MOVER_CURSO);

  const destinoCourseId = String(formData.get("destinoCourseId") ?? "").trim();

  if (!destinoCourseId) return { error: "Selecione o curso de destino." };

  const aluno = await prisma.student.findUnique({ where: { id: studentId }, include: { course: true } });
  if (!aluno) return { error: "Aluno não encontrado." };
  if (aluno.courseId === destinoCourseId) return { error: "O curso de destino deve ser diferente do curso atual." };

  // Comando de escola só atua sobre alunos da própria escola.
  const escopo = getSchoolFilter(session.role, session.escola);
  if (escopo && aluno.course.school !== escopo) {
    return { error: "Sem permissão para mover alunos de outra escola." };
  }

  const destino = await prisma.course.findUnique({ where: { id: destinoCourseId } });
  if (!destino) return { error: "Curso de destino não encontrado." };
  if (!destino.active) return { error: "O curso de destino está inativo." };
  // A escola continua a mesma — não é permitido transferir entre escolas.
  if (destino.school !== aluno.course.school) {
    return { error: "O curso de destino deve pertencer à mesma escola do aluno." };
  }

  // Número remanescente atribuído automaticamente em sequência: o primeiro
  // transferido recebe "01-R", o próximo "02-R", e assim por diante.
  const remanescentes = await prisma.student.findMany({
    where: { courseId: destinoCourseId, courseNumber: { endsWith: "-R" } },
    select: { courseNumber: true },
  });
  const maxSeq = remanescentes.reduce((max, s) => {
    const n = parseInt(s.courseNumber, 10);
    return Number.isFinite(n) && n > max ? n : max;
  }, 0);
  const proximo = maxSeq + 1;
  const novoNumero = `${String(proximo).padStart(2, "0")}-R`;

  // Pelotão (opcional) escolhido entre os pelotões do curso de destino.
  const platoonId = await validarPelotaoDoCurso(formData.get("platoonId"), destinoCourseId);
  if (platoonId === false) return { error: "Pelotão inválido para o curso de destino." };

  try {
    await prisma.student.update({
      where: { id: studentId },
      // O aluno volta a ATIVO no curso remanescente (caso tenha sido inativado
      // com o curso antigo). O pelotão passa a ser o escolhido no destino.
      data: { courseId: destinoCourseId, courseNumber: novoNumero, platoonId, status: "ATIVO" },
    });
    // Atualiza posto/graduação da conta vinculada conforme o novo curso (best-effort).
    if (aluno.userId) {
      try {
        await prisma.user.update({ where: { id: aluno.userId }, data: { rank: rankDeAluno(destino.name) } });
      } catch (e) { logger.warn("alunos: atualizar posto após transferência (best-effort)", e, { studentId }); }
    }
    await auditLog(
      session.userId, "TRANSFER", "Student", studentId,
      `${aluno.warName}: ${aluno.course.name} Nº ${aluno.courseNumber} → ${destino.name} Nº ${novoNumero}`,
    );
  } catch (e) {
    logger.error("alunos: transferir aluno", e, { studentId });
    return { error: "Erro ao transferir aluno." };
  }
  redirect(`/alunos/${studentId}`);
}

// ── Ascensão de curso ───────────────────────────────────────────────────
// O aluno sobe de um curso de menor hierarquia para outro de maior (ex.: CFO 2
// -> CFO 3). Cria uma NOVA matrícula (Student) com histórico zerado (nota 10) e
// número escolhido pelo operador. Os dados pessoais e o login/senha são mantidos
// (o vínculo do login passa para a nova matrícula). A matrícula anterior é
// preservada como histórico (marcada como TRANSFERIDA e desvinculada do login).
export async function ascenderAluno(studentId: string, _prev: State, formData: FormData): Promise<State> {
  const session = await verifyRole(...PODE_MOVER_CURSO);

  const destinoCourseId = String(formData.get("destinoCourseId") ?? "").trim();
  const novoNumeroRaw   = String(formData.get("novoNumero") ?? "").trim();

  if (!destinoCourseId) return { error: "Selecione o curso de destino." };
  if (!novoNumeroRaw)   return { error: "Informe o novo número de curso." };

  const aluno = await prisma.student.findUnique({ where: { id: studentId }, include: { course: true } });
  if (!aluno) return { error: "Aluno não encontrado." };
  if (aluno.courseId === destinoCourseId) return { error: "O curso de destino deve ser diferente do curso atual." };

  // Comando de escola só atua sobre alunos da própria escola.
  const escopo = getSchoolFilter(session.role, session.escola);
  if (escopo && aluno.course.school !== escopo) {
    return { error: "Sem permissão para mover alunos de outra escola." };
  }

  // A ascensão reinicia a nota (nova matrícula). Por isso, todas as comunicações
  // EM NOME do aluno (como comunicado) devem estar publicadas em caderno antes da
  // mudança — senão ficariam "presas" na matrícula antiga, fora do trâmite. O
  // filtro por studentId já exclui aquelas em que ele é apenas COMUNICANTE (essas
  // têm o studentId de outro aluno e seguem normalmente). Não vale p/ remanescente.
  const pendentes = await prisma.communication.findMany({
    where: { studentId, status: { not: "PUBLICADA_CADERNO" } },
    select: { protocolNumber: true },
    orderBy: { createdAt: "asc" },
  });
  if (pendentes.length > 0) {
    const lista = pendentes.slice(0, 5).map((c) => c.protocolNumber).join(", ");
    const extra = pendentes.length > 5 ? ` e mais ${pendentes.length - 5}` : "";
    return {
      error: `Ainda há ${pendentes.length} comunicação(ões) pendente(s) em nome do aluno que não foram publicadas em caderno (${lista}${extra}). É preciso tramitá-las e publicá-las antes que o aluno possa mudar de curso. Observação: comunicações em que o aluno é apenas comunicante não impedem a ascensão.`,
    };
  }

  const destino = await prisma.course.findUnique({ where: { id: destinoCourseId } });
  if (!destino) return { error: "Curso de destino não encontrado." };
  if (!destino.active) return { error: "O curso de destino está inativo." };
  // Ascensão PODE cruzar escolas (ex.: CFSd/EsFAP -> CFO/EsFO).

  // Número de curso escolhido pelo operador, padronizado em dois dígitos.
  const novoNumero = formatCourseNumber(novoNumeroRaw);

  // Não pode haver dois alunos com o mesmo número no curso de destino.
  const duplicado = await prisma.student.findFirst({
    where: { courseId: destinoCourseId, courseNumber: novoNumero, id: { not: studentId } },
    select: { id: true },
  });
  if (duplicado) return { error: `Já existe um aluno com o número ${novoNumero} neste curso.` };

  // Pelotão (opcional) escolhido entre os pelotões do curso de destino.
  const platoonId = await validarPelotaoDoCurso(formData.get("platoonId"), destinoCourseId);
  if (platoonId === false) return { error: "Pelotão inválido para o curso de destino." };

  let novoId: string;
  try {
    const userId = aluno.userId;
    // Desvincula a matrícula anterior do login e marca como transferida (preservada).
    await prisma.student.update({
      where: { id: studentId },
      data: { status: "TRANSFERIDO", ...(userId ? { userId: null } : {}) },
    });
    // Mantém o login/senha; apenas atualiza o posto conforme o novo curso.
    if (userId) {
      try {
        await prisma.user.update({ where: { id: userId }, data: { rank: rankDeAluno(destino.name) } });
      } catch (e) { logger.warn("alunos: atualizar posto na ascensão (best-effort)", e, { studentId }); }
    }
    // Nova matrícula com histórico zerado (sem comunicações) — nota volta a 10.
    const novo = await prisma.student.create({
      data: {
        fullName: aluno.fullName,
        warName: aluno.warName,
        courseId: destinoCourseId,
        courseNumber: novoNumero,
        platoonId,
        rg: aluno.rg,
        cpf: aluno.cpf,
        functionalNumber: aluno.functionalNumber,
        email: aluno.email,
        status: "ATIVO",
        ...(userId ? { userId } : {}),
      },
    });
    novoId = novo.id;
    await auditLog(
      session.userId, "ASCEND", "Student", novo.id,
      `${aluno.warName}: ${aluno.course.name} Nº ${aluno.courseNumber} → ${destino.name} Nº ${novoNumero} (nova matrícula)`,
    );
  } catch (e) {
    logger.error("alunos: ascensão de curso", e, { studentId });
    return { error: "Erro ao realizar a ascensão de curso." };
  }
  redirect(`/alunos/${novoId}`);
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
