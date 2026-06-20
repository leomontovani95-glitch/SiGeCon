"server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

const prefixos: Record<string, string> = {
  "CPI 0": "CPI",
  "CPI 1": "CPI",
  "CPI 2": "CPI",
  "CPI 3": "CPI",
  "Referência Elogiosa": "RE",
  "Elogio publicado em BI": "EBI",
  Arquivamento: "ARQ",
  "TD Leve":  "TDL",
  "TD Média": "TDM",
  "TD Grave": "TDG",
  "TAC":      "TAC",
};

export async function gerarProtocolo(typeName: string, courseName: string, adaptacao = false): Promise<string> {
  const prefixo = prefixos[typeName] ?? "COM";
  // Formato normal: "CPI-0001-CFO 1" (sem espaços ao redor dos hífens).
  // Período de adaptação: sufixo "(A)" colado ao curso e NUMERAÇÃO PRÓPRIA
  // (independente das normais), pois o endsWith filtra só as de adaptação.
  // Ex.: "CPI-0001-CFSd 2026(A)".
  const base = `${prefixo}-`;
  const sufixo = adaptacao ? `-${courseName}(A)` : `-${courseName}`;

  const ultimo = await prisma.communication.findFirst({
    where: { protocolNumber: { startsWith: base, endsWith: sufixo } },
    orderBy: { protocolNumber: "desc" },
  });

  let seq = 1;
  if (ultimo) {
    // Logo após o prefixo (ex.: "CPI-") vêm os dígitos da sequência.
    const n = parseInt(ultimo.protocolNumber.slice(base.length), 10);
    if (!isNaN(n)) seq = n + 1;
  }

  return `${base}${String(seq).padStart(4, "0")}${sufixo}`;
}

// Gera o protocolo e tenta gravar; em caso de colisão do índice @unique
// (dois registros concorrentes pegando o mesmo número), recalcula e tenta de
// novo. Fecha a janela entre ler o último número e gravar o novo.
export async function criarComProtocoloUnico<T>(
  typeName: string,
  courseName: string,
  criar: (protocolNumber: string) => Promise<T>,
  adaptacao = false,
  tentativas = 5,
): Promise<T> {
  for (let t = 1; t <= tentativas; t++) {
    const protocolNumber = await gerarProtocolo(typeName, courseName, adaptacao);
    try {
      return await criar(protocolNumber);
    } catch (e) {
      const colisao =
        e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
      if (colisao && t < tentativas) continue;
      throw e;
    }
  }
  throw new Error("Não foi possível gerar um número de protocolo único.");
}
