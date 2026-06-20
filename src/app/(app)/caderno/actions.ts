"use server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { verifyRole, getSchoolFilter, escolaNoEscopo, CADERNO_MANAGERS } from "@/lib/dal";
import { auditLog } from "@/lib/audit";

export async function criarCaderno() {
  const session = await verifyRole(...CADERNO_MANAGERS);

  // Busca comunicações DECIDIDAS — filtra pela escola do usuário para evitar contaminação cruzada
  const school = getSchoolFilter(session.role, session.escola);
  const decididas = await prisma.communication.findMany({
    where: {
      status: "DECIDIDA",
      ...(school ? { course: { school } } : {}),
    },
    include: { student: true, type: true, decisions: true },
    orderBy: { updatedAt: "asc" },
  });

  // Agrupa por courseId para criar um caderno por curso
  const porCurso = new Map<string, typeof decididas>();
  for (const comm of decididas) {
    const key = comm.courseId ?? "__sem_curso__";
    if (!porCurso.has(key)) porCurso.set(key, []);
    porCurso.get(key)!.push(comm);
  }

  let primeiroCaderno: { id: string } | null = null;

  for (const [courseKey, comms] of porCurso) {
    const courseId = courseKey === "__sem_curso__" ? null : courseKey;
    // Reaproveita rascunho existente para este curso ou cria novo
    let caderno = await prisma.disciplinaryBook.findFirst({
      where: { status: "RASCUNHO", courseId: courseId ?? undefined },
      orderBy: [{ year: "desc" }, { number: "desc" }],
    });
    if (!caderno) {
      // Numeração reinicia a cada ano: próximo nº = maior do curso NO ANO + 1.
      const ano = new Date().getFullYear();
      const ultimo = await prisma.disciplinaryBook.findFirst({
        where: { courseId: courseId ?? undefined, year: ano },
        orderBy: { number: "desc" },
      });
      caderno = await prisma.disciplinaryBook.create({
        data: { number: (ultimo?.number ?? 0) + 1, year: ano, courseId, createdById: session.userId },
      });
    }
    if (!primeiroCaderno) primeiroCaderno = caderno;

    for (const comm of comms) {
      const jaExiste = await prisma.disciplinaryBookItem.findFirst({
        where: { disciplinaryBookId: caderno.id, communicationId: comm.id },
      });
      if (jaExiste) continue;
      const decisao = comm.decisions[0];
      await prisma.disciplinaryBookItem.create({
        data: {
          disciplinaryBookId: caderno.id,
          communicationId: comm.id,
          studentId: comm.studentId,
          courseId: comm.courseId,
          platoonId: comm.platoonId,
          studentCourseNumber: comm.courseNumber,
          studentWarName: comm.student.warName,
          recordType: comm.type.name,
          factDate: comm.factDate,
          decisionSummary: decisao?.decisionType ?? "Decidida",
          score: comm.finalScore,
        },
      });
    }
    await auditLog(session.userId, "CREATE_OR_UPDATE", "DisciplinaryBook", caderno.id, `${comms.length} registro(s)`);
  }

  if (!primeiroCaderno) redirect("/caderno");
  redirect(`/caderno/${primeiroCaderno!.id}/editar`);
}

export async function publicarCaderno(id: string) {
  const session = await verifyRole(...CADERNO_MANAGERS);

  const caderno = await prisma.disciplinaryBook.findUnique({
    where: { id },
    include: { items: true, course: { select: { school: true } } },
  });
  if (!caderno) return;
  // Escopo de escola: só publica cadernos da(s) escola(s) a que tem acesso.
  if (!escolaNoEscopo(session, caderno.course?.school ?? caderno.school)) return;

  // Publica o caderno e atualiza todas as comunicações para PUBLICADA_CADERNO
  await prisma.disciplinaryBook.update({
    where: { id },
    data: { status: "PUBLICADO", publicationDate: new Date(), publishedById: session.userId },
  });

  const commIds = caderno.items.map((i) => i.communicationId);
  if (commIds.length > 0) {
    await prisma.communication.updateMany({
      where: { id: { in: commIds } },
      data: { status: "PUBLICADA_CADERNO" },
    });
  }

  await auditLog(session.userId, "PUBLICAR", "DisciplinaryBook", id, `${commIds.length} comunicação(ões) publicadas`);
  redirect(`/caderno/${id}`);
}

export async function adicionarItem(cadernoId: string, communicationId: string) {
  const session = await verifyRole(...CADERNO_MANAGERS);
  const comm = await prisma.communication.findUnique({
    where: { id: communicationId },
    include: { student: true, type: true, decisions: true, course: { select: { school: true } } },
  });
  if (!comm || comm.status !== "DECIDIDA") return;
  if (!escolaNoEscopo(session, comm.course?.school)) return;

  // Verifica se já está neste caderno
  const jaExiste = await prisma.disciplinaryBookItem.findFirst({
    where: { disciplinaryBookId: cadernoId, communicationId },
  });
  if (jaExiste) return;

  const decisao = comm.decisions[0];
  await prisma.disciplinaryBookItem.create({
    data: {
      disciplinaryBookId: cadernoId,
      communicationId,
      studentId: comm.studentId,
      courseId: comm.courseId,
      platoonId: comm.platoonId,
      studentCourseNumber: comm.courseNumber,
      studentWarName: comm.student.warName,
      recordType: comm.type.name,
      factDate: comm.factDate,
      decisionSummary: decisao?.decisionType ?? "Decidida",
      score: comm.finalScore,
    },
  });
  await auditLog(session.userId, "ADD_ITEM", "DisciplinaryBook", cadernoId, communicationId);
  redirect(`/caderno/${cadernoId}/editar`);
}

export async function removerItemCaderno(cadernoId: string, itemId: string) {
  const session = await verifyRole(...CADERNO_MANAGERS);

  const caderno = await prisma.disciplinaryBook.findUnique({
    where: { id: cadernoId },
    include: { course: { select: { school: true } } },
  });
  if (!caderno || caderno.status === "PUBLICADO") return;
  if (!escolaNoEscopo(session, caderno.course?.school ?? caderno.school)) return;

  await prisma.disciplinaryBookItem.delete({
    where: { id: itemId, disciplinaryBookId: cadernoId },
  });
  await auditLog(session.userId, "REMOVE_ITEM", "DisciplinaryBook", cadernoId, itemId);
  redirect(`/caderno/${cadernoId}/editar`);
}
