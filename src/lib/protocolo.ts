"server-only";
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

export async function gerarProtocolo(typeName: string, courseName: string): Promise<string> {
  const prefixo = prefixos[typeName] ?? "COM";
  // Formato: "CPI - 0001 - CFO 1"
  const base = `${prefixo} - `;
  const sufixo = ` - ${courseName}`;

  const ultimo = await prisma.communication.findFirst({
    where: { protocolNumber: { startsWith: base, endsWith: sufixo } },
    orderBy: { protocolNumber: "desc" },
  });

  let seq = 1;
  if (ultimo) {
    const partes = ultimo.protocolNumber.split(" - ");
    // Novo formato: ["CPI", "0001", "CFO 1"] — seq em partes[1]
    // Formato legado (pré-migração): ["CPI", "2026", "0001", "CFO 1"] — seq em partes[2]
    const seqIndex = partes.length >= 4 ? 2 : 1;
    const n = parseInt(partes[seqIndex], 10);
    if (!isNaN(n)) seq = n + 1;
  }

  return `${base}${String(seq).padStart(4, "0")}${sufixo}`;
}
