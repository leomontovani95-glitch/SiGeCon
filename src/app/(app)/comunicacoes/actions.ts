"use server";
import { redirect } from "next/navigation";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/db";
import { verifyRole, verifySession, canEmitOpinion, canDecide } from "@/lib/dal";
import { auditLog } from "@/lib/audit";
import { gerarProtocolo } from "@/lib/protocolo";
import { calcularPrazoDefesa } from "@/lib/prazos";

type State = { error: string } | undefined;

const TIPOS_PERMITIDOS = ["image/png", "image/jpeg", "application/pdf"];
const LIMITE_BYTES = 10 * 1024 * 1024; // 10 MB

// ── Registrar comunicação (CPI / Referência Elogiosa / Elogio BI) ────────
export async function registrarComunicacao(_prev: State, formData: FormData): Promise<State> {
  const session = await verifySession();
  if (session.role === "ALUNO") return { error: "Sem permissão." };

  const typeId          = String(formData.get("typeId") ?? "").trim();
  const studentId       = String(formData.get("studentId") ?? "").trim();
  const factDate        = String(formData.get("factDate") ?? "").trim();
  const factTime        = String(formData.get("factTime") ?? "").trim() || null;
  const factPlace       = String(formData.get("factPlace") ?? "").trim() || null;
  const factDescription = String(formData.get("factDescription") ?? "").trim();
  const manualRuleId    = String(formData.get("manualRuleId") ?? "").trim();
  const suggestedScore  = formData.get("suggestedScore") ? Number(formData.get("suggestedScore")) : null;
  const communicantName = String(formData.get("communicantName") ?? "").trim() || null;

  // Validações obrigatórias
  if (!studentId)       return { error: "Localize e selecione o aluno pelo número de curso." };
  if (!manualRuleId)    return { error: "Selecione o dispositivo legal completo (artigo, inciso e alínea)." };
  if (!typeId)          return { error: "Selecione o tipo de comunicação." };
  if (!factDate)        return { error: "Informe a data do fato." };
  if (!factDescription) return { error: "Descreva o fato ocorrido." };
  if (!communicantName) return { error: "Informe o nome do Comunicante." };

  // Buscar ManualRule para derivar artigo/inciso/alínea
  const regra = await prisma.manualRule.findUnique({ where: { id: manualRuleId } });
  if (!regra) return { error: "Dispositivo legal inválido. Selecione novamente." };

  const [tipo, aluno] = await Promise.all([
    prisma.communicationType.findUnique({ where: { id: typeId } }),
    prisma.student.findUnique({ where: { id: studentId }, include: { course: true } }),
  ]);
  if (!tipo)  return { error: "Tipo de comunicação não encontrado." };
  if (!aluno) return { error: "Aluno não encontrado." };

  const protocolNumber = await gerarProtocolo(tipo.name, aluno.course.name);
  try {
    const comm = await prisma.communication.create({
      data: {
        protocolNumber, typeId, studentId,
        courseId: aluno.courseId, courseNumber: aluno.courseNumber, platoonId: aluno.platoonId,
        reporterId: session.userId, factDate: new Date(factDate),
        factTime, factPlace, factDescription,
        manualRuleId,
        article: regra.article,
        item: regra.item,
        letter: regra.letter,
        suggestedScore, communicantName,
        status: "AGUARDANDO_CIENCIA",
      },
    });
    await auditLog(session.userId, "CREATE", "Communication", comm.id, `Protocolo: ${protocolNumber}`);
    redirect(`/comunicacoes/${comm.id}`);
  } catch {
    return { error: "Erro ao registrar comunicação." };
  }
}

// ── Tomar ciência e apresentar defesa (formulário único) ─────────────────
export async function tomarCienciaComDefesa(_prev: State, formData: FormData): Promise<State> {
  const session = await verifySession();
  const communicationId = String(formData.get("communicationId") ?? "");
  const text = String(formData.get("text") ?? "").trim();

  if (!text) return { error: "Digite o texto da sua justificativa/defesa." };

  const comm = await prisma.communication.findUnique({
    where: { id: communicationId },
    include: { student: true },
  });
  if (!comm) return { error: "Comunicação não encontrada." };
  if (session.role === "ALUNO" && comm.student.email !== session.email)
    return { error: "Sem permissão." };
  if (comm.status !== "AGUARDANDO_CIENCIA")
    return { error: "Esta comunicação não aguarda ciência." };

  // Processar anexo (opcional)
  let anexoId: string | null = null;
  const arquivo = formData.get("file") as File | null;
  if (arquivo && arquivo.size > 0) {
    if (!TIPOS_PERMITIDOS.includes(arquivo.type))
      return { error: "Tipo de arquivo não permitido. Use PNG, JPEG ou PDF." };
    if (arquivo.size > LIMITE_BYTES)
      return { error: "O arquivo excede o limite de 10 MB." };

    const ext = arquivo.name.split(".").pop() ?? "bin";
    const fileName = `${Date.now()}-defesa.${ext}`;
    const dir = path.join(process.cwd(), "public", "uploads", communicationId);
    await mkdir(dir, { recursive: true });
    const buffer = Buffer.from(await arquivo.arrayBuffer());
    await writeFile(path.join(dir, fileName), buffer);

    const attachment = await prisma.attachment.create({
      data: {
        communicationId,
        fileName: arquivo.name,
        filePath: `/uploads/${communicationId}/${fileName}`,
        fileType: arquivo.type,
        uploadedBy: session.userId,
      },
    });
    anexoId = attachment.id;
  }

  // Prazo de defesa: 2 dias úteis a partir de agora (ciência imediata)
  const prazo = calcularPrazoDefesa(new Date());

  await prisma.studentAcknowledgement.create({
    data: { communicationId, studentId: comm.studentId, method: "SISTEMA" },
  });
  await prisma.defense.create({
    data: {
      communicationId, studentId: comm.studentId, text,
      isLate: false, attachmentId: anexoId,
    },
  });
  await prisma.communication.update({
    where: { id: communicationId },
    data: { status: "JUSTIFICATIVA_APRESENTADA", defenseDeadline: prazo },
  });
  await auditLog(session.userId, "CIENCIA_COM_DEFESA", "Communication", communicationId,
    anexoId ? "Com anexo" : "Sem anexo");
  redirect(`/comunicacoes/${communicationId}`);
}

// ── Apenas tomar ciência (sem defesa) → vai direto ao Comandante ─────────
export async function tomarCienciaSemDefesa(_prev: State, formData: FormData): Promise<State> {
  const session = await verifySession();
  const communicationId = String(formData.get("communicationId") ?? "");

  const comm = await prisma.communication.findUnique({
    where: { id: communicationId },
    include: { student: true },
  });
  if (!comm) return { error: "Comunicação não encontrada." };
  if (session.role === "ALUNO" && comm.student.email !== session.email)
    return { error: "Sem permissão." };
  if (comm.status !== "AGUARDANDO_CIENCIA")
    return { error: "Esta comunicação não aguarda ciência." };

  await prisma.studentAcknowledgement.create({
    data: { communicationId, studentId: comm.studentId, method: "SEM_DEFESA" },
  });
  await prisma.communication.update({
    where: { id: communicationId },
    data: { status: "AGUARDANDO_DECISAO" },
  });
  await auditLog(session.userId, "CIENCIA_SEM_DEFESA", "Communication", communicationId,
    "Sem defesa — encaminhado ao Comandante");
  redirect(`/comunicacoes/${communicationId}`);
}

// ── Emitir parecer (Subcomandante / Oficial) ──────────────────────────────
export async function emitirParecer(_prev: State, formData: FormData): Promise<State> {
  const session = await verifySession();
  if (!canEmitOpinion(session.role)) return { error: "Sem permissão para emitir parecer." };

  const communicationId = String(formData.get("communicationId") ?? "");
  const text = String(formData.get("text") ?? "").trim();
  const recommendation = String(formData.get("recommendation") ?? "").trim() || null;
  if (!text) return { error: "Informe o texto do parecer." };
  if (!recommendation) return { error: "Selecione uma recomendação." };

  const existente = await prisma.opinion.findFirst({ where: { communicationId } });
  if (existente) return { error: "Já existe um parecer registrado para esta comunicação." };

  await prisma.opinion.create({
    data: { communicationId, authorId: session.userId, authorRole: session.role, text, recommendation },
  });
  await prisma.communication.update({
    where: { id: communicationId },
    data: { status: "AGUARDANDO_DECISAO" },
  });
  await auditLog(session.userId, "PARECER", "Communication", communicationId);
  redirect(`/comunicacoes/${communicationId}`);
}

// ── Proferir decisão (Comandante) ─────────────────────────────────────────
export async function proferirDecisao(_prev: State, formData: FormData): Promise<State> {
  const session = await verifySession();
  if (!canDecide(session.role)) return { error: "Sem permissão para proferir decisão." };

  const communicationId = String(formData.get("communicationId") ?? "");
  const decisionType = String(formData.get("decisionType") ?? "");
  const text = String(formData.get("text") ?? "").trim();
  const finalScore = formData.get("finalScore") ? Number(formData.get("finalScore")) : null;
  if (!text || !decisionType) return { error: "Informe decisão e fundamentação." };

  // Captura artigo original antes de qualquer atualização (para histórico de reenquadramento)
  const commOriginal = await prisma.communication.findUnique({
    where: { id: communicationId },
    select: { article: true, item: true, letter: true },
  });
  const originalArticle = commOriginal?.article ?? null;
  const originalItem    = commOriginal?.item    ?? null;
  const originalLetter  = commOriginal?.letter  ?? null;

  // Reenquadramento: atualiza o artigo da comunicação
  const commUpdate: Record<string, unknown> = { status: "DECIDIDA", finalScore };
  if (decisionType === "Reenquadrar artigo") {
    const newManualRuleId = String(formData.get("newManualRuleId") ?? "").trim();
    if (!newManualRuleId) return { error: "Selecione o novo artigo para reenquadramento." };
    const regra = await prisma.manualRule.findUnique({ where: { id: newManualRuleId } });
    if (!regra) return { error: "Artigo não encontrado no Manual do Aluno." };
    commUpdate.manualRuleId = regra.id;
    commUpdate.article = regra.article;
    commUpdate.item = regra.item ?? null;
    commUpdate.letter = regra.letter ?? null;
  }

  await prisma.decision.create({
    data: { communicationId, authorityId: session.userId, decisionType, text, finalScore },
  });
  await prisma.communication.update({ where: { id: communicationId }, data: commUpdate });
  await auditLog(session.userId, "DECISAO", "Communication", communicationId, decisionType);

  // Adiciona automaticamente ao caderno em rascunho do mesmo curso
  const comm = await prisma.communication.findUnique({
    where: { id: communicationId },
    include: { student: true, type: true },
  });
  if (comm) {
    const courseId = comm.courseId;
    // Busca o caderno em rascunho para este curso específico
    let caderno = await prisma.disciplinaryBook.findFirst({
      where: { status: "RASCUNHO", courseId },
      orderBy: { number: "desc" },
    });
    if (!caderno) {
      // Próximo número dentro deste curso
      const ultimoDoCurso = await prisma.disciplinaryBook.findFirst({
        where: { courseId },
        orderBy: { number: "desc" },
      });
      caderno = await prisma.disciplinaryBook.create({
        data: { number: (ultimoDoCurso?.number ?? 0) + 1, courseId, createdById: session.userId },
      });
    }
    const jaExiste = await prisma.disciplinaryBookItem.findFirst({
      where: { disciplinaryBookId: caderno.id, communicationId },
    });
    if (!jaExiste) {
      await prisma.disciplinaryBookItem.create({
        data: {
          disciplinaryBookId: caderno.id,
          communicationId,
          studentId: comm.studentId,
          courseId: comm.courseId,
          platoonId: comm.platoonId,
          studentCourseNumber: comm.courseNumber,
          studentWarName: comm.student.warName,
          recordType: comm.type.name,
          factDate: comm.factDate,
          decisionSummary: decisionType,
          score: finalScore,
          originalArticle,
          originalItem,
          originalLetter,
        },
      });
    }
  }

  redirect(`/comunicacoes/${communicationId}`);
}

// ── Encaminhar para parecer (Protocolo / Admin) ───────────────────────────
export async function encaminharParaParecer(_prev: State, formData: FormData): Promise<State> {
  const session = await verifyRole("ADMINISTRADOR", "PROTOCOLO");
  const communicationId = String(formData.get("communicationId") ?? "");
  await prisma.communication.update({
    where: { id: communicationId },
    data: { status: "AGUARDANDO_PARECER" },
  });
  await auditLog(session.userId, "ENCAMINHAR_PARECER", "Communication", communicationId);
  redirect(`/comunicacoes/${communicationId}`);
}
