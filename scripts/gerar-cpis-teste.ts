/**
 * Script de teste: gera CPIs para dois alunos do CFSd 2025,
 * faz todo o trâmite (ciência → parecer → decisão → caderno publicado)
 * e os deixa com nota abaixo de 7,0.
 */
import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import path from "path";

const dbPath = path.resolve(process.cwd(), "dev.db").replace(/\\/g, "/");
const prisma = new PrismaClient({ adapter: new PrismaLibSql({ url: `file:///${dbPath}` }) });

async function gerarProtocolo(typeName: string, courseName: string): Promise<string> {
  const prefixos: Record<string, string> = { "CPI 0": "CPI", "CPI 1": "CPI", "CPI 2": "CPI", "CPI 3": "CPI" };
  const prefixo = prefixos[typeName] ?? "COM";
  const base = `${prefixo} - `;
  const sufixo = ` - ${courseName}`;
  const ultimo = await prisma.communication.findFirst({
    where: { protocolNumber: { startsWith: base, endsWith: sufixo } },
    orderBy: { protocolNumber: "desc" },
  });
  let seq = 1;
  if (ultimo) {
    const partes = ultimo.protocolNumber.split(" - ");
    const seqIndex = partes.length >= 4 ? 2 : 1;
    const n = parseInt(partes[seqIndex], 10);
    if (!isNaN(n)) seq = n + 1;
  }
  return `${base}${String(seq).padStart(4, "0")}${sufixo}`;
}

async function tramitarComunicacao(
  commId: string,
  studentId: string,
  adminId: string,
  finalScore: number,
) {
  // 1. Ciência sem defesa
  await prisma.studentAcknowledgement.create({
    data: { communicationId: commId, studentId, method: "SEM_DEFESA", notes: "Tomou ciência e optou por não apresentar defesa." },
  });
  await prisma.communication.update({ where: { id: commId }, data: { status: "AGUARDANDO_PARECER" } });

  // 2. Parecer
  await prisma.opinion.create({
    data: {
      communicationId: commId,
      authorId: adminId,
      authorRole: "CHEFE_DIVISAO_ACADEMICA",
      text: "Analisados os fatos e a ausência de defesa, manifesto-me pelo reconhecimento da infração e aplicação da sanção prevista.",
      recommendation: "Aplicação de sanção disciplinar conforme o NPCE.",
    },
  });
  await prisma.communication.update({ where: { id: commId }, data: { status: "AGUARDANDO_DECISAO" } });

  // 3. Decisão do Comandante
  await prisma.decision.create({
    data: {
      communicationId: commId,
      authorityId: adminId,
      decisionType: "Sanção Disciplinar",
      text: "Reconhecida a infração disciplinar. Aplicada a sanção prevista no NPCE, com desconto de pontos na nota de conduta.",
      finalScore,
    },
  });
  await prisma.communication.update({ where: { id: commId }, data: { status: "DECIDIDA", finalScore } });
}

async function main() {
  // ── Buscar dados necessários ─────────────────────────────────────────────
  const admin = await prisma.user.findFirst({ where: { role: "ADMINISTRADOR" } });
  if (!admin) throw new Error("Admin não encontrado");

  const curso = await prisma.course.findFirst({ where: { name: "CFSd 2025", active: true } });
  if (!curso) throw new Error("Curso CFSd 2025 não encontrado");

  const tipoCpi3 = await prisma.communicationType.findFirst({ where: { name: "CPI 3" } });
  const tipoCpi2 = await prisma.communicationType.findFirst({ where: { name: "CPI 2" } });
  const tipoCpi1 = await prisma.communicationType.findFirst({ where: { name: "CPI 1" } });
  if (!tipoCpi3 || !tipoCpi2 || !tipoCpi1) throw new Error("Tipos de CPI não encontrados");

  const regra = await prisma.manualRule.findFirst({ where: { active: true } });
  if (!regra) throw new Error("Nenhuma regra encontrada");

  // Dois alunos aleatórios do CFSd 2025
  const alunos = await prisma.student.findMany({
    where: { courseId: curso.id, status: "ATIVO" },
    include: { platoon: true },
    take: 2,
    skip: 3, // pula os primeiros para pegar alunos diferentes
  });
  if (alunos.length < 2) throw new Error("Alunos insuficientes no CFSd 2025");

  const [a1, a2] = alunos;
  console.log(`\n✅ Alunos selecionados:`);
  console.log(`   A1: ${a1.warName} — Nº ${a1.courseNumber} — ${a1.platoon?.name}`);
  console.log(`   A2: ${a2.warName} — Nº ${a2.courseNumber} — ${a2.platoon?.name}`);

  // ── ALUNO 1: 6x CPI 3 → nota = 10 - 3.6 = 6.4 ──────────────────────────
  console.log(`\n📋 Gerando CPIs para ${a1.warName}...`);
  const cpisa1: { tipo: typeof tipoCpi3; score: number }[] = [
    { tipo: tipoCpi3, score: 0.6 },
    { tipo: tipoCpi3, score: 0.6 },
    { tipo: tipoCpi3, score: 0.6 },
    { tipo: tipoCpi3, score: 0.6 },
    { tipo: tipoCpi3, score: 0.6 },
    { tipo: tipoCpi3, score: 0.6 },
  ];

  const commsA1: string[] = [];
  for (const { tipo, score } of cpisa1) {
    const protocolo = await gerarProtocolo(tipo.name, curso.name);
    const comm = await prisma.communication.create({
      data: {
        protocolNumber: protocolo,
        typeId: tipo.id,
        studentId: a1.id,
        courseId: curso.id,
        courseNumber: a1.courseNumber,
        platoonId: a1.platoonId ?? undefined,
        reporterId: admin.id,
        factDate: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000),
        factDescription: "Aluno flagrado com fardamento em desalinho durante a instrução.",
        manualRuleId: regra.id,
        article: regra.article,
        item: regra.item ?? undefined,
        suggestedScore: score,
        communicantName: "INSTRUTORA OLIVEIRA",
        status: "REGISTRADA",
      },
    });
    await tramitarComunicacao(comm.id, a1.id, admin.id, score);
    commsA1.push(comm.id);
    console.log(`   ✓ ${protocolo} — ${tipo.name} (−${score} pt) → DECIDIDA`);
  }

  // ── ALUNO 2: 5x CPI 3 + 1x CPI 2 → nota = 10 - 3.4 = 6.6 ──────────────
  console.log(`\n📋 Gerando CPIs para ${a2.warName}...`);
  const cpisa2: { tipo: typeof tipoCpi3; score: number }[] = [
    { tipo: tipoCpi3, score: 0.6 },
    { tipo: tipoCpi3, score: 0.6 },
    { tipo: tipoCpi3, score: 0.6 },
    { tipo: tipoCpi3, score: 0.6 },
    { tipo: tipoCpi3, score: 0.6 },
    { tipo: tipoCpi2, score: 0.4 },
  ];

  const commsA2: string[] = [];
  for (const { tipo, score } of cpisa2) {
    const protocolo = await gerarProtocolo(tipo.name, curso.name);
    const comm = await prisma.communication.create({
      data: {
        protocolNumber: protocolo,
        typeId: tipo.id,
        studentId: a2.id,
        courseId: curso.id,
        courseNumber: a2.courseNumber,
        platoonId: a2.platoonId ?? undefined,
        reporterId: admin.id,
        factDate: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000),
        factDescription: "Aluno em desacordo com as normas de conduta durante o serviço.",
        manualRuleId: regra.id,
        article: regra.article,
        item: regra.item ?? undefined,
        suggestedScore: score,
        communicantName: "INSTRUTOR SANTOS",
        status: "REGISTRADA",
      },
    });
    await tramitarComunicacao(comm.id, a2.id, admin.id, score);
    commsA2.push(comm.id);
    console.log(`   ✓ ${protocolo} — ${tipo.name} (−${score} pt) → DECIDIDA`);
  }

  // ── Criar e publicar caderno ─────────────────────────────────────────────
  console.log(`\n📒 Criando caderno para ${curso.name}...`);

  const ultimoCaderno = await prisma.disciplinaryBook.findFirst({
    where: { courseId: curso.id },
    orderBy: { number: "desc" },
  });
  const numeroCaderno = (ultimoCaderno?.number ?? 0) + 1;

  const caderno = await prisma.disciplinaryBook.create({
    data: { number: numeroCaderno, courseId: curso.id, createdById: admin.id, status: "RASCUNHO" },
  });

  const todasComms = [...commsA1, ...commsA2];
  for (const commId of todasComms) {
    const comm = await prisma.communication.findUnique({
      where: { id: commId },
      include: { type: true, student: true, decisions: true },
    });
    if (!comm) continue;
    await prisma.disciplinaryBookItem.create({
      data: {
        disciplinaryBookId: caderno.id,
        communicationId: comm.id,
        studentId: comm.studentId,
        courseId: comm.courseId,
        platoonId: comm.platoonId ?? undefined,
        studentCourseNumber: comm.courseNumber,
        studentWarName: comm.student.warName,
        recordType: comm.type.name,
        factDate: comm.factDate,
        decisionSummary: comm.decisions[0]?.decisionType ?? "Sanção Disciplinar",
        score: comm.finalScore,
        originalArticle: comm.article ?? undefined,
        originalItem: comm.item ?? undefined,
      },
    });
  }

  // Publica o caderno
  await prisma.disciplinaryBook.update({
    where: { id: caderno.id },
    data: { status: "PUBLICADO", publicationDate: new Date(), publishedById: admin.id },
  });
  await prisma.communication.updateMany({
    where: { id: { in: todasComms } },
    data: { status: "PUBLICADA_CADERNO" },
  });

  console.log(`   ✓ Caderno Nº ${numeroCaderno} publicado com ${todasComms.length} comunicações`);

  // ── Resumo final ─────────────────────────────────────────────────────────
  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`  RESULTADO FINAL`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`  ${a1.warName.padEnd(20)} → nota estimada: 6.40 (6x CPI 3)`);
  console.log(`  ${a2.warName.padEnd(20)} → nota estimada: 6.60 (5x CPI 3 + 1x CPI 2)`);
  console.log(`  Ambos devem aparecer na caixa de alerta do painel.`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
