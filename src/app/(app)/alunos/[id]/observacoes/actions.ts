"use server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { verifySession, canManageObservacoes, podeEditarObservacao, escolaNoEscopo } from "@/lib/dal";
import { auditLog } from "@/lib/audit";
import { uploadsDir } from "@/lib/uploads";
import { logger } from "@/lib/logger";

export type ObsState = { error: string } | { ok: true } | undefined;

const TIPOS_PERMITIDOS = ["image/png", "image/jpeg", "application/pdf"];
const LIMITE_TOTAL_BYTES = 5 * 1024 * 1024; // 5 MB total
const NATUREZAS = ["POSITIVA", "NEGATIVA", "NEUTRA"];

// Grava os arquivos enviados como ObservationAttachment em uploads/observacoes/<obsId>.
async function salvarAnexos(observationId: string, arquivos: File[], uploadedBy: string) {
  if (arquivos.length === 0) return;
  const dir = path.join(uploadsDir(), "observacoes", observationId);
  await mkdir(dir, { recursive: true });
  for (const arquivo of arquivos) {
    const ext = arquivo.name.split(".").pop() ?? "bin";
    const savedName = `${Date.now()}-${Math.random().toString(36).slice(2)}-obs.${ext}`;
    const buffer = Buffer.from(await arquivo.arrayBuffer());
    await writeFile(path.join(dir, savedName), buffer);
    await prisma.observationAttachment.create({
      data: {
        observationId,
        fileName: arquivo.name,
        filePath: `/uploads/observacoes/${observationId}/${savedName}`,
        fileType: arquivo.type,
        uploadedBy,
      },
    });
  }
}

// Valida tipo e tamanho total dos anexos. Retorna mensagem de erro ou null.
function validarAnexos(arquivos: File[]): string | null {
  if (arquivos.length === 0) return null;
  for (const f of arquivos) {
    if (!TIPOS_PERMITIDOS.includes(f.type)) return `Formato inválido (${f.name}). Use PNG, JPEG ou PDF.`;
  }
  const totalBytes = arquivos.reduce((s, f) => s + f.size, 0);
  if (totalBytes > LIMITE_TOTAL_BYTES)
    return `O total dos arquivos excede o limite de 5 MB (${(totalBytes / 1024 / 1024).toFixed(1)} MB enviado).`;
  return null;
}

// ── Adicionar observação ao histórico do aluno ───────────────────────────
export async function criarObservacao(_prev: ObsState, formData: FormData): Promise<ObsState> {
  const session = await verifySession();
  if (!canManageObservacoes(session.role, session.additionalRoles))
    return { error: "Sem permissão para registrar observações." };

  const studentId = String(formData.get("studentId") ?? "").trim();
  const nature = String(formData.get("nature") ?? "").trim();
  const text = String(formData.get("text") ?? "").trim();

  if (!studentId) return { error: "Aluno não informado." };
  if (!NATUREZAS.includes(nature)) return { error: "Selecione a natureza da observação." };
  if (!text) return { error: "Escreva o texto da observação." };

  const aluno = await prisma.student.findUnique({
    where: { id: studentId },
    include: { course: { select: { school: true } } },
  });
  if (!aluno) return { error: "Aluno não encontrado." };
  if (!escolaNoEscopo(session, aluno.course.school))
    return { error: "Sem permissão para registrar observação para aluno de outra escola." };

  const arquivos = (formData.getAll("file") as File[]).filter((f) => f && f.size > 0);
  const erroAnexo = validarAnexos(arquivos);
  if (erroAnexo) return { error: erroAnexo };

  try {
    const obs = await prisma.studentObservation.create({
      data: {
        studentId,
        authorId: session.userId,
        authorRoleSnapshot: session.role,
        nature,
        text,
      },
    });
    await salvarAnexos(obs.id, arquivos, session.userId);
    await auditLog(session.userId, "CRIAR", "StudentObservation", obs.id, `aluno=${studentId} natureza=${nature}`);
  } catch (e) {
    logger.error("Falha ao criar observação", { studentId, erro: String(e) });
    return { error: "Não foi possível registrar a observação. Tente novamente." };
  }

  revalidatePath(`/alunos/${studentId}/observacoes`);
  return { ok: true };
}

// ── Editar observação (somente autor; Administrador exceção) ──────────────
export async function editarObservacao(_prev: ObsState, formData: FormData): Promise<ObsState> {
  const session = await verifySession();
  if (!canManageObservacoes(session.role, session.additionalRoles))
    return { error: "Sem permissão para editar observações." };

  const observationId = String(formData.get("observationId") ?? "").trim();
  const nature = String(formData.get("nature") ?? "").trim();
  const text = String(formData.get("text") ?? "").trim();

  if (!observationId) return { error: "Observação não informada." };
  if (!NATUREZAS.includes(nature)) return { error: "Selecione a natureza da observação." };
  if (!text) return { error: "Escreva o texto da observação." };

  const obs = await prisma.studentObservation.findUnique({
    where: { id: observationId },
    include: { student: { include: { course: { select: { school: true } } } } },
  });
  if (!obs) return { error: "Observação não encontrada." };
  if (!escolaNoEscopo(session, obs.student.course.school))
    return { error: "Sem permissão sobre observações de aluno de outra escola." };
  if (!podeEditarObservacao(session, obs))
    return { error: "Apenas o autor (ou o Administrador) pode editar esta observação." };

  const arquivos = (formData.getAll("file") as File[]).filter((f) => f && f.size > 0);
  const erroAnexo = validarAnexos(arquivos);
  if (erroAnexo) return { error: erroAnexo };

  try {
    await prisma.studentObservation.update({
      where: { id: observationId },
      data: { nature, text, editedAt: new Date() },
    });
    await salvarAnexos(observationId, arquivos, session.userId);
    await auditLog(session.userId, "EDITAR", "StudentObservation", observationId, `aluno=${obs.studentId} natureza=${nature}`);
  } catch (e) {
    logger.error("Falha ao editar observação", { observationId, erro: String(e) });
    return { error: "Não foi possível salvar a observação. Tente novamente." };
  }

  revalidatePath(`/alunos/${obs.studentId}/observacoes`);
  return { ok: true };
}
