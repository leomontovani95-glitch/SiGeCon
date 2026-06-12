import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import path from "path";

const dbPath = path.resolve(process.cwd(), "dev.db").replace(/\\/g, "/");
const prisma = new PrismaClient({ adapter: new PrismaLibSql({ url: `file:///${dbPath}` }) });

async function gerarProtocolo(typeName: string, courseName: string): Promise<string> {
  const base = `CPI - `;
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

async function main() {
  const admin = await prisma.user.findFirst({ where: { role: "ADMINISTRADOR" } });
  if (!admin) throw new Error("Admin não encontrado");

  const brunno = await prisma.student.findFirst({
    where: { warName: "BRUNNO", status: "ATIVO" },
    include: { course: true },
  });
  if (!brunno) throw new Error("BRUNNO não encontrado");

  const tipoCpi3 = await prisma.communicationType.findFirst({ where: { name: "CPI 3" } });
  if (!tipoCpi3) throw new Error("CPI 3 não encontrada");

  const regra = await prisma.manualRule.findFirst({ where: { active: true } });
  if (!regra) throw new Error("Regra não encontrada");

  // 1x CPI 3 → 6.40 - 0.6 = 5.80 (abaixo de 6,0)
  const protocolo = await gerarProtocolo(tipoCpi3.name, brunno.course.name);
  const comm = await prisma.communication.create({
    data: {
      protocolNumber: protocolo,
      typeId: tipoCpi3.id,
      studentId: brunno.id,
      courseId: brunno.courseId,
      courseNumber: brunno.courseNumber,
      platoonId: brunno.platoonId ?? undefined,
      reporterId: admin.id,
      factDate: new Date(),
      factDescription: "Aluno reincidente em desalinho de fardamento.",
      manualRuleId: regra.id,
      article: regra.article,
      item: regra.item ?? undefined,
      suggestedScore: 0.6,
      communicantName: "INSTRUTOR FERREIRA",
      status: "REGISTRADA",
    },
  });

  // Ciência sem defesa
  await prisma.studentAcknowledgement.create({
    data: { communicationId: comm.id, studentId: brunno.id, method: "SEM_DEFESA" },
  });
  await prisma.communication.update({ where: { id: comm.id }, data: { status: "AGUARDANDO_PARECER" } });

  // Parecer
  await prisma.opinion.create({
    data: {
      communicationId: comm.id,
      authorId: admin.id,
      authorRole: "CHEFE_DIVISAO_ACADEMICA",
      text: "Aluno reincidente. Manifesto-me pela aplicação da sanção.",
      recommendation: "Aplicação de sanção disciplinar.",
    },
  });
  await prisma.communication.update({ where: { id: comm.id }, data: { status: "AGUARDANDO_DECISAO" } });

  // Decisão
  await prisma.decision.create({
    data: {
      communicationId: comm.id,
      authorityId: admin.id,
      decisionType: "Sanção Disciplinar",
      text: "Aplicada sanção disciplinar por reincidência.",
      finalScore: 0.6,
    },
  });
  await prisma.communication.update({ where: { id: comm.id }, data: { status: "DECIDIDA", finalScore: 0.6 } });

  // Caderno e publicação
  const ultimoCaderno = await prisma.disciplinaryBook.findFirst({
    where: { courseId: brunno.courseId },
    orderBy: { number: "desc" },
  });
  const caderno = await prisma.disciplinaryBook.create({
    data: { number: (ultimoCaderno?.number ?? 0) + 1, courseId: brunno.courseId, createdById: admin.id, status: "RASCUNHO" },
  });
  await prisma.disciplinaryBookItem.create({
    data: {
      disciplinaryBookId: caderno.id,
      communicationId: comm.id,
      studentId: brunno.id,
      courseId: brunno.courseId,
      platoonId: brunno.platoonId ?? undefined,
      studentCourseNumber: brunno.courseNumber,
      studentWarName: brunno.warName,
      recordType: tipoCpi3.name,
      factDate: comm.factDate,
      decisionSummary: "Sanção Disciplinar",
      score: 0.6,
      originalArticle: regra.article,
      originalItem: regra.item ?? undefined,
    },
  });
  await prisma.disciplinaryBook.update({
    where: { id: caderno.id },
    data: { status: "PUBLICADO", publicationDate: new Date(), publishedById: admin.id },
  });
  await prisma.communication.update({ where: { id: comm.id }, data: { status: "PUBLICADA_CADERNO" } });

  console.log(`✅ ${protocolo} — CPI 3 (−0.6 pt) publicada`);
  console.log(`   BRUNNO: nota estimada 6.40 − 0.60 = 5.80 ⛔`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
