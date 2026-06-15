"use server";
import { redirect } from "next/navigation";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/db";
import { verifyRole, verifySession, canEmitOpinion, canDecide, ESFO_CFO_RANK, cursosPermitidosParaCPI, escolaNoEscopo } from "@/lib/dal";
import { auditLog } from "@/lib/audit";
import { criarComProtocoloUnico } from "@/lib/protocolo";
import { comTransacaoRetry, adicionarAoCaderno } from "@/lib/caderno";
import { logger } from "@/lib/logger";
import { calcularPrazoDefesa } from "@/lib/prazos";

type State = { error: string } | undefined;
export type LoteState =
  | { error: string }
  | { success: true; count: number; protocols: string[]; falhas: { label: string; motivo: string }[] }
  | undefined;

const TIPOS_PERMITIDOS = ["image/png", "image/jpeg", "application/pdf"];
const LIMITE_TOTAL_BYTES = 5 * 1024 * 1024; // 5 MB total

// ── Registrar comunicação (CPI / Referência Elogiosa / Elogio BI) ────────
export async function registrarComunicacao(_prev: State, formData: FormData): Promise<State> {
  const session = await verifySession();
  const isAluno = session.role === "ALUNO";

  const typeId          = String(formData.get("typeId") ?? "").trim();
  const studentId       = String(formData.get("studentId") ?? "").trim();
  const factDate        = String(formData.get("factDate") ?? "").trim();
  const factTime        = String(formData.get("factTime") ?? "").trim() || null;
  const factPlace       = String(formData.get("factPlace") ?? "").trim() || null;
  const factDescription = String(formData.get("factDescription") ?? "").trim();
  const manualRuleId    = String(formData.get("manualRuleId") ?? "").trim();
  const suggestedScore  = formData.get("suggestedScore") ? Number(formData.get("suggestedScore")) : null;
  const communicantRank = String(formData.get("communicantRank") ?? "").trim();
  const communicantNameRaw = String(formData.get("communicantName") ?? "").trim();
  const communicantName = communicantRank
    ? `${communicantRank} ${communicantNameRaw}`.trim()
    : communicantNameRaw || null;
  const communicantUserId = String(formData.get("communicantUserId") ?? "").trim() || null;
  const adaptationPeriod = formData.get("adaptationPeriod") === "true";

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

  if (isAluno) {
    // Apenas CPI e Referência Elogiosa são permitidos para alunos
    const TIPOS_ALUNO = ["CPI 0", "CPI 1", "CPI 2", "CPI 3", "Referência Elogiosa"];
    if (!TIPOS_ALUNO.includes(tipo.name)) return { error: "Tipo de comunicação não permitido." };

    // Verificar se o aluno comunicante é do CFO (EsFO) e obter seu curso
    const reporter = await prisma.student.findFirst({
      where: { userId: session.userId },
      include: { course: true },
    });
    if (!reporter || !(reporter.course.name in ESFO_CFO_RANK)) return { error: "Sem permissão para registrar comunicações." };

    // Comunicante deve ser o próprio aluno
    if (communicantUserId !== session.userId) return { error: "O comunicante deve ser o próprio aluno." };

    // Aluno não pode comunicar a si mesmo
    if (aluno.userId === session.userId) return { error: "Não é possível registrar comunicação do próprio aluno." };

    // Verificar se o aluno-alvo está em um curso permitido pela hierarquia
    const allCourses = await prisma.course.findMany({ where: { active: true }, select: { id: true, name: true, school: true } });
    const allowedIds = cursosPermitidosParaCPI(reporter.course.name, allCourses);
    if (!allowedIds.includes(aluno.courseId)) return { error: "Você não tem permissão para comunicar um aluno deste curso." };
  } else if (session.role === "ALUNO") {
    // Segurança: garante que nenhum outro aluno chegue aqui
    return { error: "Sem permissão." };
  }

  // Testemunhas
  const witnessRanks = formData.getAll("witnessRank") as string[];
  const witnessNames = formData.getAll("witnessName") as string[];
  const testemunhas = witnessRanks
    .map((rank, i) => ({ rank: rank.trim(), name: (witnessNames[i] ?? "").trim() }))
    .filter((w) => w.name);

  // Validar anexos antes de criar a comunicação
  const arquivosProva = (formData.getAll("file") as File[]).filter((f) => f && f.size > 0);
  if (arquivosProva.length > 0) {
    for (const f of arquivosProva) {
      if (!TIPOS_PERMITIDOS.includes(f.type))
        return { error: `Tipo de arquivo não permitido (${f.name}). Use PNG, JPEG ou PDF.` };
    }
    const totalBytes = arquivosProva.reduce((s, f) => s + f.size, 0);
    if (totalBytes > LIMITE_TOTAL_BYTES)
      return { error: `O total dos arquivos excede o limite de 5 MB (${(totalBytes / 1024 / 1024).toFixed(1)} MB enviado).` };
  }

  let commId: string;
  let protocolNumber: string;
  try {
    const comm = await criarComProtocoloUnico(tipo.name, aluno.course.name, (pn) =>
      prisma.communication.create({
        data: {
          protocolNumber: pn, typeId, studentId,
          courseId: aluno.courseId, courseNumber: aluno.courseNumber, platoonId: aluno.platoonId,
          reporterId: session.userId, factDate: new Date(factDate + "T12:00:00"),
          factTime, factPlace, factDescription,
          manualRuleId,
          article: regra.article,
          item: regra.item,
          letter: regra.letter,
          suggestedScore, communicantName, communicantUserId,
          adaptationPeriod,
          status: "AGUARDANDO_CIENCIA",
          defenseDeadline: calcularPrazoDefesa(new Date()),
        },
      }),
    );
    commId = comm.id;
    protocolNumber = comm.protocolNumber;
  } catch (e) {
    logger.error("registrarComunicacao: criar comunicação", e);
    return { error: "Erro ao registrar comunicação." };
  }

  // Salvar testemunhas (best-effort)
  if (testemunhas.length > 0) {
    try {
      await prisma.witness.createMany({
        data: testemunhas.map((w) => ({
          communicationId: commId,
          name: w.rank ? `${w.rank} ${w.name}` : w.name,
        })),
      });
    } catch (e) { logger.error("registrarComunicacao: salvar testemunhas (best-effort)", e, { commId }); }
  }

  // Salvar anexos (meios de prova) vinculados à comunicação
  if (arquivosProva.length > 0) {
    try {
      const dir = path.join(process.cwd(), "public", "uploads", commId);
      await mkdir(dir, { recursive: true });
      for (const arquivo of arquivosProva) {
        const ext = arquivo.name.split(".").pop() ?? "bin";
        const savedName = `${Date.now()}-${Math.random().toString(36).slice(2)}-prova.${ext}`;
        const buffer = Buffer.from(await arquivo.arrayBuffer());
        await writeFile(path.join(dir, savedName), buffer);
        await prisma.attachment.create({
          data: {
            communicationId: commId,
            fileName: arquivo.name,
            filePath: `/uploads/${commId}/${savedName}`,
            fileType: arquivo.type,
            uploadedBy: session.userId,
          },
        });
      }
    } catch (e) { logger.error("registrarComunicacao: salvar anexos (best-effort)", e, { commId }); }
  }

  try { await auditLog(session.userId, "CREATE", "Communication", commId, `Protocolo: ${protocolNumber}`); }
  catch (e) { logger.error("registrarComunicacao: auditLog (best-effort)", e, { commId }); }
  redirect(`/comunicacoes/${commId}`);
}

// ── Registrar comunicação em lote (múltiplos alunos, mesmo fato) ─────────
export async function registrarComunicacaoEmLote(_prev: LoteState, formData: FormData): Promise<LoteState> {
  const session = await verifySession();
  if (session.role === "ALUNO") return { error: "Sem permissão." };

  const studentIds = (formData.getAll("studentId") as string[]).map(String).filter(Boolean);
  if (studentIds.length < 2) return { error: "Selecione ao menos 2 alunos para registro em lote." };

  const typeId          = String(formData.get("typeId") ?? "").trim();
  const factDate        = String(formData.get("factDate") ?? "").trim();
  const factTime        = String(formData.get("factTime") ?? "").trim() || null;
  const factPlace       = String(formData.get("factPlace") ?? "").trim() || null;
  const factDescription = String(formData.get("factDescription") ?? "").trim();
  const manualRuleId    = String(formData.get("manualRuleId") ?? "").trim();
  const suggestedScore  = formData.get("suggestedScore") ? Number(formData.get("suggestedScore")) : null;
  const communicantRank = String(formData.get("communicantRank") ?? "").trim();
  const communicantNameRaw = String(formData.get("communicantName") ?? "").trim();
  const communicantName = communicantRank ? `${communicantRank} ${communicantNameRaw}`.trim() : communicantNameRaw || null;
  const communicantUserId = String(formData.get("communicantUserId") ?? "").trim() || null;
  const adaptationPeriod = formData.get("adaptationPeriod") === "true";

  if (!manualRuleId)    return { error: "Selecione o dispositivo legal completo." };
  if (!typeId)          return { error: "Selecione o tipo de comunicação." };
  if (!factDate)        return { error: "Informe a data do fato." };
  if (!factDescription) return { error: "Descreva o fato ocorrido." };
  if (!communicantName) return { error: "Informe o comunicante." };

  const regra = await prisma.manualRule.findUnique({ where: { id: manualRuleId } });
  if (!regra) return { error: "Dispositivo legal inválido." };

  const tipo = await prisma.communicationType.findUnique({ where: { id: typeId } });
  if (!tipo) return { error: "Tipo de comunicação não encontrado." };

  const witnessRanks = formData.getAll("witnessRank") as string[];
  const witnessNames = formData.getAll("witnessName") as string[];
  const testemunhas = witnessRanks
    .map((rank, i) => ({ rank: rank.trim(), name: (witnessNames[i] ?? "").trim() }))
    .filter((w) => w.name);

  const protocols: string[] = [];
  const falhas: { label: string; motivo: string }[] = [];
  for (const studentId of studentIds) {
    const aluno = await prisma.student.findUnique({ where: { id: studentId }, include: { course: true } });
    if (!aluno) {
      falhas.push({ label: studentId, motivo: "Aluno não encontrado." });
      continue;
    }

    try {
      const comm = await criarComProtocoloUnico(tipo.name, aluno.course.name, (pn) =>
        prisma.communication.create({
          data: {
            protocolNumber: pn, typeId, studentId,
            courseId: aluno.courseId, courseNumber: aluno.courseNumber, platoonId: aluno.platoonId,
            reporterId: session.userId, factDate: new Date(factDate + "T12:00:00"),
            factTime, factPlace, factDescription,
            manualRuleId, article: regra.article, item: regra.item, letter: regra.letter,
            suggestedScore, communicantName, communicantUserId, adaptationPeriod,
            status: "AGUARDANDO_CIENCIA",
            defenseDeadline: calcularPrazoDefesa(new Date()),
          },
        }),
      );
      if (testemunhas.length > 0) {
        await prisma.witness.createMany({
          data: testemunhas.map((w) => ({
            communicationId: comm.id,
            name: w.rank ? `${w.rank} ${w.name}` : w.name,
          })),
        }).catch((e) => logger.error("registrarComunicacaoEmLote: testemunhas (best-effort)", e, { commId: comm.id }));
      }
      await auditLog(session.userId, "CREATE", "Communication", comm.id, `Lote — Protocolo: ${comm.protocolNumber}`)
        .catch((e) => logger.error("registrarComunicacaoEmLote: auditLog (best-effort)", e, { commId: comm.id }));
      protocols.push(comm.protocolNumber);
    } catch (e) {
      logger.error("registrarComunicacaoEmLote: registrar aluno", e, { studentId });
      falhas.push({ label: `${aluno.warName} (Nº ${aluno.courseNumber})`, motivo: "Erro ao registrar." });
    }
  }

  if (protocols.length === 0) return { error: "Nenhuma comunicação pôde ser registrada. Verifique os dados." };
  return { success: true, count: protocols.length, protocols, falhas };
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
  if (comm.student.userId !== session.userId)
    return { error: "Apenas o próprio aluno pode tomar ciência ou apresentar defesa." };
  if (comm.status !== "AGUARDANDO_CIENCIA")
    return { error: "Esta comunicação não aguarda ciência." };
  if (comm.adaptationPeriod)
    return { error: "Comunicações em Período de Adaptação não permitem apresentação de defesa." };

  // Processar anexos (opcionais — múltiplos, total ≤ 5 MB)
  const arquivos = (formData.getAll("file") as File[]).filter((f) => f && f.size > 0);
  if (arquivos.length > 0) {
    for (const f of arquivos) {
      if (!TIPOS_PERMITIDOS.includes(f.type))
        return { error: `Tipo de arquivo não permitido (${f.name}). Use PNG, JPEG ou PDF.` };
    }
    const totalBytes = arquivos.reduce((s, f) => s + f.size, 0);
    if (totalBytes > LIMITE_TOTAL_BYTES)
      return { error: `O total dos arquivos excede o limite de 5 MB (${(totalBytes / 1024 / 1024).toFixed(1)} MB enviado).` };
  }

  // Prazo de defesa: 2 dias úteis a partir de agora (ciência imediata)
  const prazo = calcularPrazoDefesa(new Date());

  try {
    await prisma.studentAcknowledgement.create({
      data: { communicationId, studentId: comm.studentId, method: "SISTEMA" },
    });
    const defense = await prisma.defense.create({
      data: { communicationId, studentId: comm.studentId, text, isLate: false },
    });

    // Salvar cada arquivo como Attachment vinculado à defesa
    if (arquivos.length > 0) {
      const dir = path.join(process.cwd(), "public", "uploads", communicationId);
      await mkdir(dir, { recursive: true });
      for (const arquivo of arquivos) {
        const ext = arquivo.name.split(".").pop() ?? "bin";
        const savedName = `${Date.now()}-${Math.random().toString(36).slice(2)}-defesa.${ext}`;
        const buffer = Buffer.from(await arquivo.arrayBuffer());
        await writeFile(path.join(dir, savedName), buffer);
        await prisma.attachment.create({
          data: {
            communicationId,
            defenseId: defense.id,
            fileName: arquivo.name,
            filePath: `/uploads/${communicationId}/${savedName}`,
            fileType: arquivo.type,
            uploadedBy: session.userId,
          },
        });
      }
    }

    await prisma.communication.update({
      where: { id: communicationId },
      data: { status: "AGUARDANDO_PARECER", defenseDeadline: prazo },
    });
    await auditLog(session.userId, "CIENCIA_COM_DEFESA", "Communication", communicationId,
      arquivos.length > 0 ? `Com ${arquivos.length} anexo(s) — encaminhado ao Subcomandante/Oficial` : "Sem anexo — encaminhado ao Subcomandante/Oficial");
  } catch (e) {
    logger.error("tomarCienciaComDefesa", e, { communicationId });
    return { error: "Erro ao registrar ciência/defesa. Tente novamente." };
  }
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
  if (comm.student.userId !== session.userId)
    return { error: "Apenas o próprio aluno pode tomar ciência ou apresentar defesa." };
  if (comm.status !== "AGUARDANDO_CIENCIA")
    return { error: "Esta comunicação não aguarda ciência." };

  try {
    await prisma.studentAcknowledgement.create({
      data: { communicationId, studentId: comm.studentId, method: "SEM_DEFESA" },
    });
    await prisma.communication.update({
      where: { id: communicationId },
      data: { status: "AGUARDANDO_PARECER" },
    });
    await auditLog(session.userId, "CIENCIA_SEM_DEFESA", "Communication", communicationId,
      "Sem defesa — encaminhado ao Subcomandante/Oficial para parecer");
  } catch (e) {
    logger.error("tomarCienciaSemDefesa", e, { communicationId });
    return { error: "Erro ao registrar ciência. Tente novamente." };
  }
  redirect(`/comunicacoes/${communicationId}`);
}

// ── Tomar ciência durante Período de Adaptação → decisão automática ─────────
export async function tomarCienciaAdaptacao(_prev: State, formData: FormData): Promise<State> {
  const session = await verifySession();
  const communicationId = String(formData.get("communicationId") ?? "");

  const comm = await prisma.communication.findUnique({
    where: { id: communicationId },
    include: { student: true, type: true },
  });
  if (!comm) return { error: "Comunicação não encontrada." };
  if (comm.student.userId !== session.userId)
    return { error: "Apenas o próprio aluno pode tomar ciência ou apresentar defesa." };
  if (comm.status !== "AGUARDANDO_CIENCIA")
    return { error: "Esta comunicação não aguarda ciência." };
  if (!comm.adaptationPeriod)
    return { error: "Ação exclusiva para comunicações em Período de Adaptação." };

  const admin = await prisma.user.findFirst({
    where: { role: "ADMINISTRADOR", active: true },
    select: { id: true },
  });
  const authorityId = admin?.id ?? comm.reporterId;

  try {
    await prisma.studentAcknowledgement.create({
      data: { communicationId, studentId: comm.studentId, method: "SEM_DEFESA" },
    });

    await prisma.decision.create({
      data: {
        communicationId,
        authorityId,
        decisionType: "Período de Adaptação",
        text: "Comunicação registrada em Período de Adaptação. Não haverá impacto na nota de conduta.",
        finalScore: 0,
      },
    });

    await prisma.communication.update({
      where: { id: communicationId },
      data: { status: "DECIDIDA", finalScore: 0 },
    });

    await auditLog(session.userId, "CIENCIA_ADAPTACAO", "Communication", communicationId,
      "Período de Adaptação — decisão automática, sem impacto na nota");

    // Adiciona ao caderno rascunho do mesmo curso
    await comTransacaoRetry((tx) =>
      adicionarAoCaderno(tx, comm.courseId, authorityId, {
        communicationId,
        studentId: comm.studentId,
        courseId: comm.courseId,
        platoonId: comm.platoonId,
        studentCourseNumber: comm.courseNumber,
        studentWarName: comm.student.warName,
        recordType: comm.type.name,
        factDate: comm.factDate,
        decisionSummary: "Período de Adaptação",
        shortObservation: "Período de Adaptação",
        score: 0,
      }),
    );
  } catch (e) {
    logger.error("tomarCienciaAdaptacao", e, { communicationId });
    return { error: "Erro ao registrar ciência. Tente novamente." };
  }
  redirect(`/comunicacoes/${communicationId}`);
}

// ── Emitir parecer (Subcomandante / Oficial) ──────────────────────────────
export async function emitirParecer(_prev: State, formData: FormData): Promise<State> {
  const session = await verifySession();
  if (!canEmitOpinion(session.role, session.additionalRoles)) return { error: "Sem permissão para emitir parecer." };

  const communicationId = String(formData.get("communicationId") ?? "");
  const text = String(formData.get("text") ?? "").trim();
  const recommendation = String(formData.get("recommendation") ?? "").trim() || null;
  const newManualRuleIdParecer = String(formData.get("newManualRuleIdParecer") ?? "").trim() || null;
  if (!text) return { error: "Informe o texto do parecer." };
  if (!recommendation) return { error: "Selecione uma recomendação." };
  if (recommendation === "Sugiro reenquadramento de artigo" && !newManualRuleIdParecer) {
    return { error: "Selecione o artigo sugerido para reenquadramento." };
  }

  // Processar anexos (opcionais)
  const arquivosParecer = (formData.getAll("file") as File[]).filter((f) => f && f.size > 0);
  if (arquivosParecer.length > 0) {
    for (const f of arquivosParecer) {
      if (!TIPOS_PERMITIDOS.includes(f.type))
        return { error: `Tipo de arquivo não permitido (${f.name}). Use PNG, JPEG ou PDF.` };
    }
    const totalBytes = arquivosParecer.reduce((s, f) => s + f.size, 0);
    if (totalBytes > LIMITE_TOTAL_BYTES)
      return { error: `O total dos arquivos excede o limite de 5 MB (${(totalBytes / 1024 / 1024).toFixed(1)} MB enviado).` };
  }

  const commEscopo = await prisma.communication.findUnique({
    where: { id: communicationId },
    include: { course: { select: { school: true } } },
  });
  if (!commEscopo) return { error: "Comunicação não encontrada." };
  if (!escolaNoEscopo(session, commEscopo.course.school))
    return { error: "Sem permissão: comunicação de outra escola." };
  if (!["AGUARDANDO_PARECER", "JUSTIFICATIVA_APRESENTADA"].includes(commEscopo.status))
    return { error: "Esta comunicação não está aguardando parecer." };

  const existente = await prisma.opinion.findFirst({ where: { communicationId } });
  if (existente) return { error: "Já existe um parecer registrado para esta comunicação." };

  // Se reenquadramento, inclui o artigo sugerido na recomendação
  let recommendationFinal = recommendation;
  if (recommendation === "Sugiro reenquadramento de artigo" && newManualRuleIdParecer) {
    const regra = await prisma.manualRule.findUnique({ where: { id: newManualRuleIdParecer } });
    if (regra) {
      recommendationFinal = `Sugiro reenquadramento — Art. ${regra.article}${regra.item ? `, Inc. ${regra.item}` : ""}${regra.letter ? `, Al. ${regra.letter}` : ""}`;
    }
  }

  const opinion = await prisma.opinion.create({
    data: { communicationId, authorId: session.userId, authorRole: session.role, text, recommendation: recommendationFinal },
  });

  // Salvar anexos vinculados ao parecer
  if (arquivosParecer.length > 0) {
    const dir = path.join(process.cwd(), "public", "uploads", communicationId);
    await mkdir(dir, { recursive: true });
    for (const arquivo of arquivosParecer) {
      const ext = arquivo.name.split(".").pop() ?? "bin";
      const savedName = `${Date.now()}-${Math.random().toString(36).slice(2)}-parecer.${ext}`;
      const buffer = Buffer.from(await arquivo.arrayBuffer());
      await writeFile(path.join(dir, savedName), buffer);
      await prisma.attachment.create({
        data: {
          communicationId,
          opinionId: opinion.id,
          fileName: arquivo.name,
          filePath: `/uploads/${communicationId}/${savedName}`,
          fileType: arquivo.type,
          uploadedBy: session.userId,
        },
      });
    }
  }

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
  if (!canDecide(session.role, session.additionalRoles)) return { error: "Sem permissão para proferir decisão." };

  const communicationId = String(formData.get("communicationId") ?? "");
  const decisionType = String(formData.get("decisionType") ?? "");
  const text = String(formData.get("text") ?? "").trim();
  const finalScore = formData.get("finalScore") ? Number(formData.get("finalScore")) : null;
  if (!text || !decisionType) return { error: "Informe decisão e fundamentação." };

  // Captura artigo original antes de qualquer atualização (para histórico de reenquadramento)
  const commOriginal = await prisma.communication.findUnique({
    where: { id: communicationId },
    select: { article: true, item: true, letter: true, status: true, course: { select: { school: true } } },
  });
  if (!commOriginal) return { error: "Comunicação não encontrada." };
  if (!escolaNoEscopo(session, commOriginal.course.school))
    return { error: "Sem permissão: comunicação de outra escola." };
  if (commOriginal.status !== "AGUARDANDO_DECISAO")
    return { error: "Esta comunicação não está aguardando decisão." };
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

  // Processar anexos da decisão (opcionais)
  const arquivosDecisao = (formData.getAll("fileDecisao") as File[]).filter((f) => f && f.size > 0);
  if (arquivosDecisao.length > 0) {
    for (const f of arquivosDecisao) {
      if (!TIPOS_PERMITIDOS.includes(f.type))
        return { error: `Tipo de arquivo não permitido (${f.name}). Use PNG, JPEG ou PDF.` };
    }
    const totalBytes = arquivosDecisao.reduce((s, f) => s + f.size, 0);
    if (totalBytes > LIMITE_TOTAL_BYTES)
      return { error: `O total dos arquivos excede o limite de 5 MB (${(totalBytes / 1024 / 1024).toFixed(1)} MB enviado).` };
  }

  const decision = await prisma.decision.create({
    data: { communicationId, authorityId: session.userId, decisionType, text, finalScore },
  });

  // Salvar anexos vinculados à decisão
  if (arquivosDecisao.length > 0) {
    const dir = path.join(process.cwd(), "public", "uploads", communicationId);
    await mkdir(dir, { recursive: true });
    for (const arquivo of arquivosDecisao) {
      const ext = arquivo.name.split(".").pop() ?? "bin";
      const savedName = `${Date.now()}-${Math.random().toString(36).slice(2)}-decisao.${ext}`;
      const buffer = Buffer.from(await arquivo.arrayBuffer());
      await writeFile(path.join(dir, savedName), buffer);
      await prisma.attachment.create({
        data: {
          communicationId,
          decisionId: decision.id,
          fileName: arquivo.name,
          filePath: `/uploads/${communicationId}/${savedName}`,
          fileType: arquivo.type,
          uploadedBy: session.userId,
        },
      });
    }
  }

  await prisma.communication.update({ where: { id: communicationId }, data: commUpdate });
  await auditLog(session.userId, "DECISAO", "Communication", communicationId, decisionType);

  // Adiciona automaticamente ao caderno em rascunho do mesmo curso
  const comm = await prisma.communication.findUnique({
    where: { id: communicationId },
    include: { student: true, type: true },
  });
  if (comm) {
    await comTransacaoRetry((tx) =>
      adicionarAoCaderno(tx, comm.courseId, session.userId, {
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
      }),
    );
  }

  redirect(`/comunicacoes/${communicationId}`);
}

// ── Corrigir pontuação após decisão (Comandante) ──────────────────────────
export async function corrigirPontuacao(_prev: State, formData: FormData): Promise<State> {
  const session = await verifySession();
  if (!canDecide(session.role, session.additionalRoles))
    return { error: "Sem permissão para corrigir pontuação." };

  const decisionId = String(formData.get("decisionId") ?? "").trim();
  const communicationId = String(formData.get("communicationId") ?? "").trim();
  const raw = formData.get("novaScore");
  const novaScore = raw !== null && raw !== "" ? Number(raw) : null;

  if (!decisionId || !communicationId) return { error: "Dados inválidos." };

  const decision = await prisma.decision.findFirst({
    where: { id: decisionId, communicationId },
    include: { communication: { select: { course: { select: { school: true } } } } },
  });
  if (!decision) return { error: "Decisão não encontrada." };
  if (!escolaNoEscopo(session, decision.communication.course.school))
    return { error: "Sem permissão: comunicação de outra escola." };

  await prisma.decision.update({ where: { id: decisionId }, data: { finalScore: novaScore } });
  await prisma.communication.update({ where: { id: communicationId }, data: { finalScore: novaScore } });
  await prisma.disciplinaryBookItem.updateMany({ where: { communicationId }, data: { score: novaScore } });

  await auditLog(
    session.userId,
    "CORRECAO_PONTUACAO",
    "Decision",
    decisionId,
    `Pontuação corrigida para: ${novaScore ?? 0}`,
  );

  redirect(`/comunicacoes/${communicationId}`);
}

// ── Registrar Elogio Publicado em BI ─────────────────────────────────────────
export async function registrarElogioBi(_prev: State, formData: FormData): Promise<State> {
  const session = await verifySession();
  if (session.role === "ALUNO") return { error: "Sem permissão." };

  const studentId    = String(formData.get("studentId")    ?? "").trim();
  const courseId     = String(formData.get("courseId")     ?? "").trim();
  const manualRuleId = String(formData.get("manualRuleId") ?? "").trim();
  const bgpmNumber   = String(formData.get("bgpmNumber")   ?? "").trim();
  const bgpmYear     = String(formData.get("bgpmYear")     ?? "").trim();

  if (!studentId)    return { error: "Localize e selecione o aluno." };
  if (!courseId)     return { error: "Selecione o curso." };
  if (!manualRuleId) return { error: "Selecione o dispositivo legal." };
  if (!bgpmNumber)   return { error: "Informe o número do BGPM." };
  if (!bgpmYear)     return { error: "Informe o ano do BGPM." };

  const [aluno, tipo, regra] = await Promise.all([
    prisma.student.findUnique({ where: { id: studentId }, include: { course: true } }),
    prisma.communicationType.findFirst({ where: { name: "Elogio publicado em BI" } }),
    prisma.manualRule.findUnique({ where: { id: manualRuleId } }),
  ]);

  if (!aluno)  return { error: "Aluno não encontrado." };
  if (!tipo)   return { error: "Tipo 'Elogio publicado em BI' não cadastrado no sistema." };
  if (!regra)  return { error: "Dispositivo legal não encontrado." };

  const score = tipo.score; // 1.0 conforme seed

  const descricao = [
    `Elogio publicado em BI`,
    `Art. ${regra.article}${regra.item ? `, Inc. ${regra.item}` : ""}${regra.letter ? `, Al. ${regra.letter}` : ""}`,
    regra.description ? `— ${regra.description}` : "",
    `BGPM Nº ${bgpmNumber}/${bgpmYear}.`,
  ].filter(Boolean).join(" — ");

  const comm = await criarComProtocoloUnico("Elogio publicado em BI", aluno.course.name, (pn) =>
    prisma.communication.create({
      data: {
        protocolNumber:  pn,
        typeId:          tipo.id,
        studentId,
        courseId,
        courseNumber:    aluno.courseNumber,
        platoonId:       aluno.platoonId ?? undefined,
        reporterId:      session.userId,
        factDate:        new Date(),
        factDescription: descricao,
        finalScore:      score,
        status:          "DECIDIDA",
        bgpmNumber,
        bgpmYear,
        manualRuleId:    regra.id,
        article:         regra.article,
        item:            regra.item,
        letter:          regra.letter,
      },
    }),
  );
  const protocolo = comm.protocolNumber;

  await comTransacaoRetry((tx) =>
    adicionarAoCaderno(tx, courseId, session.userId, {
      communicationId:     comm.id,
      studentId,
      courseId,
      platoonId:           aluno.platoonId,
      studentCourseNumber: aluno.courseNumber,
      studentWarName:      aluno.warName,
      recordType:          "Elogio publicado em BI",
      factDate:            comm.factDate,
      decisionSummary:     "Elogio publicado em BI",
      score,
    }),
  );

  await auditLog(session.userId, "CREATE", "Communication", comm.id, protocolo);
  redirect(`/comunicacoes/${comm.id}`);
}

// ── Registrar Transgressão Disciplinar / TAC ─────────────────────────────────
export async function registrarTransgressao(_prev: State, formData: FormData): Promise<State> {
  const session = await verifySession();
  if (session.role === "ALUNO") return { error: "Sem permissão." };

  const studentId       = String(formData.get("studentId")       ?? "").trim();
  const courseId        = String(formData.get("courseId")        ?? "").trim();
  const tipoComunicacao = String(formData.get("tipoComunicacao") ?? "").trim();
  const tacEquivalent   = String(formData.get("tacEquivalent")   ?? "").trim() || null;
  const scoreRaw        = formData.get("score");
  const score           = scoreRaw ? parseFloat(String(scoreRaw)) : NaN;
  const bgpmNumber      = String(formData.get("bgpmNumber")      ?? "").trim();
  const bgpmYear        = String(formData.get("bgpmYear")        ?? "").trim();

  if (!studentId)       return { error: "Localize e selecione o aluno." };
  if (!courseId)        return { error: "Selecione o curso." };
  if (!tipoComunicacao) return { error: "Selecione o tipo de transgressão." };
  if (tipoComunicacao === "TAC" && !tacEquivalent) return { error: "Selecione a transgressão equivalente do TAC." };
  if (isNaN(score) || score <= 0) return { error: "Informe uma pontuação válida." };
  if (!bgpmNumber)      return { error: "Informe o número do BGPM." };
  if (!bgpmYear)        return { error: "Informe o ano do BGPM." };

  const [aluno, tipo] = await Promise.all([
    prisma.student.findUnique({ where: { id: studentId }, include: { course: true } }),
    prisma.communicationType.findFirst({ where: { name: tipoComunicacao } }),
  ]);
  if (!aluno) return { error: "Aluno não encontrado." };
  if (!tipo)  return { error: "Tipo de transgressão não cadastrado no sistema." };

  const descricao = tipoComunicacao === "TAC"
    ? `Termo de Ajuste de Conduta (equivalente a ${tacEquivalent}) — BGPM Nº ${bgpmNumber}/${bgpmYear}.`
    : `${tipoComunicacao} — BGPM Nº ${bgpmNumber}/${bgpmYear}.`;

  const comm = await criarComProtocoloUnico(tipoComunicacao, aluno.course.name, (pn) =>
    prisma.communication.create({
      data: {
        protocolNumber:  pn,
        typeId:          tipo.id,
        studentId,
        courseId,
        courseNumber:    aluno.courseNumber,
        platoonId:       aluno.platoonId ?? undefined,
        reporterId:      session.userId,
        factDate:        new Date(),
        factDescription: descricao,
        finalScore:      score,
        status:          "DECIDIDA",
        bgpmNumber,
        bgpmYear,
        tacEquivalent:   tacEquivalent ?? undefined,
      },
    }),
  );
  const protocolo = comm.protocolNumber;

  await comTransacaoRetry((tx) =>
    adicionarAoCaderno(tx, courseId, session.userId, {
      communicationId:     comm.id,
      studentId,
      courseId,
      platoonId:           aluno.platoonId,
      studentCourseNumber: aluno.courseNumber,
      studentWarName:      aluno.warName,
      recordType:          tipoComunicacao,
      factDate:            comm.factDate,
      decisionSummary:     tipoComunicacao === "TAC" ? `TAC — ${tacEquivalent}` : tipoComunicacao,
      score,
    }),
  );

  await auditLog(session.userId, "CREATE", "Communication", comm.id, protocolo);
  redirect(`/comunicacoes/${comm.id}`);
}

