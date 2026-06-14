"server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

function isUniqueViolation(e: unknown): boolean {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
}

// Executa uma transação interativa e a repete caso colida em alguma constraint
// @unique (ex.: número de caderno gerado concorrentemente para o mesmo curso).
export async function comTransacaoRetry<T>(
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
  tentativas = 5,
): Promise<T> {
  for (let t = 1; t <= tentativas; t++) {
    try {
      return await prisma.$transaction(fn);
    } catch (e) {
      if (isUniqueViolation(e) && t < tentativas) continue;
      throw e;
    }
  }
  throw new Error("Transação não pôde ser concluída após múltiplas tentativas.");
}

export type ItemCaderno = {
  communicationId: string;
  studentId: string;
  courseId: string | null;
  platoonId: string | null;
  studentCourseNumber: string;
  studentWarName: string;
  recordType: string;
  factDate: Date;
  decisionSummary: string;
  score: number | null;
  shortObservation?: string | null;
  originalArticle?: string | null;
  originalItem?: string | null;
  originalLetter?: string | null;
};

// Garante o caderno RASCUNHO do curso (cria o próximo número se não existir) e
// adiciona a comunicação como item, de forma idempotente. Deve ser chamada
// dentro de comTransacaoRetry para tratar a corrida no número do caderno.
export async function adicionarAoCaderno(
  tx: Prisma.TransactionClient,
  courseId: string,
  createdById: string,
  item: ItemCaderno,
): Promise<void> {
  let caderno = await tx.disciplinaryBook.findFirst({
    where: { status: "RASCUNHO", courseId },
    orderBy: { number: "desc" },
  });
  if (!caderno) {
    const ultimo = await tx.disciplinaryBook.findFirst({
      where: { courseId },
      orderBy: { number: "desc" },
    });
    caderno = await tx.disciplinaryBook.create({
      data: { number: (ultimo?.number ?? 0) + 1, courseId, createdById },
    });
  }

  // @@unique([disciplinaryBookId, communicationId]) protege contra duplicação;
  // a checagem mantém a operação idempotente sem lançar erro.
  const jaExiste = await tx.disciplinaryBookItem.findFirst({
    where: { disciplinaryBookId: caderno.id, communicationId: item.communicationId },
    select: { id: true },
  });
  if (jaExiste) return;

  await tx.disciplinaryBookItem.create({
    data: {
      disciplinaryBookId: caderno.id,
      communicationId: item.communicationId,
      studentId: item.studentId,
      courseId: item.courseId,
      platoonId: item.platoonId,
      studentCourseNumber: item.studentCourseNumber,
      studentWarName: item.studentWarName,
      recordType: item.recordType,
      factDate: item.factDate,
      decisionSummary: item.decisionSummary,
      score: item.score,
      shortObservation: item.shortObservation ?? null,
      originalArticle: item.originalArticle ?? null,
      originalItem: item.originalItem ?? null,
      originalLetter: item.originalLetter ?? null,
    },
  });
}
