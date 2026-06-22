"server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { isUniqueViolation, isBancoOcupado } from "@/lib/db-erros";

// Executa uma transação interativa e a repete em dois casos de concorrência:
// (1) colisão de constraint @unique (ex.: número de caderno gerado ao mesmo tempo
// para o mesmo curso) e (2) "banco ocupado" (lock de escrita do SQLite). No caso
// do lock, espera um pouco entre tentativas (backoff) para dar vez ao escritor.
export async function comTransacaoRetry<T>(
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
  tentativas = 5,
): Promise<T> {
  for (let t = 1; t <= tentativas; t++) {
    try {
      return await prisma.$transaction(fn);
    } catch (e) {
      const ocupado = isBancoOcupado(e);
      if ((isUniqueViolation(e) || ocupado) && t < tentativas) {
        if (ocupado) await new Promise((r) => setTimeout(r, t * 50));
        continue;
      }
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
    orderBy: [{ year: "desc" }, { number: "desc" }],
  });
  if (!caderno) {
    // Numeração reinicia a cada ano: próximo nº = maior do curso NO ANO + 1.
    const ano = new Date().getFullYear();
    const ultimo = await tx.disciplinaryBook.findFirst({
      where: { courseId, year: ano },
      orderBy: { number: "desc" },
    });
    caderno = await tx.disciplinaryBook.create({
      data: { number: (ultimo?.number ?? 0) + 1, year: ano, courseId, createdById },
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
