import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import path from "path";

const dbPath = path.resolve(process.cwd(), "dev.db").replace(/\\/g, "/");
const prisma = new PrismaClient({ adapter: new PrismaLibSql({ url: `file:///${dbPath}` }) });

async function main() {
  // Pegar um aluno qualquer para testar
  const aluno = await prisma.student.findFirst({ include: { course: true } });
  console.log("Aluno:", aluno?.warName, "| Curso:", aluno?.course.name);

  // Pegar um usuário staff
  const staff = await prisma.user.findFirst({ where: { role: { not: "ALUNO" } } });
  console.log("Staff:", staff?.warName);

  // Pegar tipo TD Leve
  const tipo = await prisma.communicationType.findFirst({ where: { name: "TD Leve" } });
  console.log("Tipo:", tipo?.name);

  if (!aluno || !staff || !tipo) { console.log("Dados insuficientes"); return; }

  // Simular criação de Communication
  try {
    const comm = await prisma.communication.create({
      data: {
        protocolNumber:  `TEST - 2026 - 9999 - ${aluno.course.name}`,
        typeId:          tipo.id,
        studentId:       aluno.id,
        courseId:        aluno.courseId,
        courseNumber:    aluno.courseNumber,
        platoonId:       aluno.platoonId ?? undefined,
        reporterId:      staff.id,
        factDate:        new Date(),
        factDescription: "TD Leve — BGPM Nº 001/2026.",
        finalScore:      1.0,
        status:          "DECIDIDA",
        bgpmNumber:      "001",
        bgpmYear:        "2026",
      },
    });
    console.log("Communication criada:", comm.id);

    // Criar item no caderno rascunho
    let caderno = await prisma.disciplinaryBook.findFirst({
      where: { status: "RASCUNHO", courseId: aluno.courseId },
      orderBy: { number: "desc" },
    });
    console.log("Caderno rascunho:", caderno?.id ?? "nenhum");

    if (!caderno) {
      const anoCaderno = new Date().getFullYear();
      const ultimo = await prisma.disciplinaryBook.findFirst({
        where: { courseId: aluno.courseId, year: anoCaderno },
        orderBy: { number: "desc" },
      });
      caderno = await prisma.disciplinaryBook.create({
        data: { number: (ultimo?.number ?? 0) + 1, year: anoCaderno, courseId: aluno.courseId, createdById: staff.id },
      });
      console.log("Caderno criado:", caderno.id);
    }

    const item = await prisma.disciplinaryBookItem.create({
      data: {
        disciplinaryBookId:  caderno.id,
        communicationId:     comm.id,
        studentId:           aluno.id,
        courseId:            aluno.courseId,
        platoonId:           aluno.platoonId ?? undefined,
        studentCourseNumber: aluno.courseNumber,
        studentWarName:      aluno.warName,
        recordType:          "TD Leve",
        factDate:            comm.factDate,
        decisionSummary:     "TD Leve",
        score:               1.0,
      },
    });
    console.log("Item criado:", item.id);
    console.log("SUCESSO — rollback para não poluir o banco");
    // Limpar
    await prisma.disciplinaryBookItem.delete({ where: { id: item.id } });
    await prisma.communication.delete({ where: { id: comm.id } });
    console.log("Rollback OK");
  } catch (e) {
    console.error("ERRO:", e);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
