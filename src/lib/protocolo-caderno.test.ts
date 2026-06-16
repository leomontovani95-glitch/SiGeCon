import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { gerarProtocolo, criarComProtocoloUnico } from "@/lib/protocolo";
import { adicionarAoCaderno, comTransacaoRetry } from "@/lib/caderno";
import { calcularNotaPublicada } from "@/lib/score";

const TEST_DB = path.resolve(process.cwd(), "prisma/test.db");

let courseId: string, typeCpiId: string, typeReId: string, reporterId: string, studentId: string;

beforeAll(() => {
  for (const f of [TEST_DB, TEST_DB + "-wal", TEST_DB + "-shm"]) {
    if (fs.existsSync(f)) fs.rmSync(f);
  }
  execSync('npx prisma db push --url "file:./prisma/test.db" --accept-data-loss', {
    stdio: "ignore",
  });
}, 60000);

beforeEach(async () => {
  await prisma.disciplinaryBookItem.deleteMany();
  await prisma.disciplinaryBook.deleteMany();
  await prisma.communication.deleteMany();
  await prisma.student.deleteMany();
  await prisma.communicationType.deleteMany();
  await prisma.course.deleteMany();
  await prisma.user.deleteMany();

  const course = await prisma.course.create({ data: { name: "CFO 1", acronym: "CFO1", school: "ESFO" } });
  courseId = course.id;
  const cpi = await prisma.communicationType.create({ data: { name: "CPI 1", score: 0.2, scoreNature: "DESFAVORAVEL" } });
  typeCpiId = cpi.id;
  const re = await prisma.communicationType.create({ data: { name: "Referência Elogiosa", score: 0.2, scoreNature: "FAVORAVEL" } });
  typeReId = re.id;
  const user = await prisma.user.create({ data: { fullName: "Rep", warName: "REP", rank: "Cap", rg: "R1", functionalNumber: "F1", passwordHash: "x" } });
  reporterId = user.id;
  const student = await prisma.student.create({ data: { fullName: "Aluno X", warName: "X", courseId, courseNumber: "001", rg: "S1" } });
  studentId = student.id;
});

function novaComm(protocolNumber: string, typeId = typeCpiId) {
  return prisma.communication.create({
    data: { protocolNumber, typeId, studentId, courseId, courseNumber: "001", reporterId, factDate: new Date(), factDescription: "f" },
  });
}

const itemBase = (communicationId: string, score: number | null) => ({
  communicationId, studentId, courseId,
  platoonId: null, studentCourseNumber: "001", studentWarName: "X",
  recordType: "CPI 1", factDate: new Date(), decisionSummary: "Punição", score,
});

describe("gerarProtocolo", () => {
  it("começa em 0001 quando não há comunicações", async () => {
    expect(await gerarProtocolo("CPI 1", "CFO 1")).toBe("CPI - 0001 - CFO 1");
  });

  it("incrementa a partir do último (formato novo)", async () => {
    await novaComm("CPI - 0007 - CFO 1");
    expect(await gerarProtocolo("CPI 1", "CFO 1")).toBe("CPI - 0008 - CFO 1");
  });

  it("interpreta o formato legado (4 partes) e segue a sequência", async () => {
    await novaComm("CPI - 2026 - 0003 - CFO 1");
    expect(await gerarProtocolo("CPI 1", "CFO 1")).toBe("CPI - 0004 - CFO 1");
  });

  it("isola a sequência por curso (sufixo)", async () => {
    await novaComm("CPI - 0009 - CFO 1");
    expect(await gerarProtocolo("CPI 1", "CFO 2")).toBe("CPI - 0001 - CFO 2");
  });
});

describe("criarComProtocoloUnico", () => {
  it("faz retry quando o create colide com P2002 e conclui", async () => {
    let calls = 0;
    const comm = await criarComProtocoloUnico("CPI 1", "CFO 1", async (pn) => {
      calls++;
      if (calls === 1) {
        throw new Prisma.PrismaClientKnownRequestError("colisão", { code: "P2002", clientVersion: "test" });
      }
      return novaComm(pn);
    });
    expect(calls).toBe(2);
    expect(comm.protocolNumber).toBe("CPI - 0001 - CFO 1");
  });

  it("gera números sequenciais únicos em chamadas seguidas", async () => {
    const a = await criarComProtocoloUnico("CPI 1", "CFO 1", (pn) => novaComm(pn));
    const b = await criarComProtocoloUnico("CPI 1", "CFO 1", (pn) => novaComm(pn));
    expect(a.protocolNumber).toBe("CPI - 0001 - CFO 1");
    expect(b.protocolNumber).toBe("CPI - 0002 - CFO 1");
  });
});

describe("adicionarAoCaderno", () => {
  it("cria o caderno rascunho e adiciona o item uma única vez (idempotente)", async () => {
    const comm = await novaComm("CPI - 0001 - CFO 1");
    const add = () => comTransacaoRetry((tx) => adicionarAoCaderno(tx, courseId, reporterId, itemBase(comm.id, 0.2)));
    await add();
    await add(); // repetição não duplica

    const books = await prisma.disciplinaryBook.findMany();
    const items = await prisma.disciplinaryBookItem.findMany();
    expect(books).toHaveLength(1);
    expect(books[0].status).toBe("RASCUNHO");
    expect(books[0].number).toBe(1);
    expect(items).toHaveLength(1);
  });

  it("o índice único rejeita a mesma comunicação no mesmo caderno", async () => {
    const comm = await novaComm("CPI - 0001 - CFO 1");
    const book = await prisma.disciplinaryBook.create({ data: { number: 1, year: 2026, courseId, createdById: reporterId } });
    await prisma.disciplinaryBookItem.create({ data: { disciplinaryBookId: book.id, ...itemBase(comm.id, 0.2) } });
    await expect(
      prisma.disciplinaryBookItem.create({ data: { disciplinaryBookId: book.id, ...itemBase(comm.id, 0.2) } }),
    ).rejects.toThrow();
  });
});

describe("calcularNotaPublicada sobre itens reais publicados", () => {
  it("desconta desfavorável e soma favorável a partir do banco", async () => {
    const c1 = await novaComm("CPI - 0001 - CFO 1", typeCpiId);
    const c2 = await novaComm("RE - 0001 - CFO 1", typeReId);
    const book = await prisma.disciplinaryBook.create({ data: { number: 1, year: 2026, courseId, status: "PUBLICADO", createdById: reporterId } });
    await prisma.disciplinaryBookItem.create({ data: { disciplinaryBookId: book.id, ...itemBase(c1.id, 0.2) } });
    await prisma.disciplinaryBookItem.create({ data: { disciplinaryBookId: book.id, ...itemBase(c2.id, 0.2), recordType: "Referência Elogiosa" } });

    const items = await prisma.disciplinaryBookItem.findMany({
      where: { disciplinaryBook: { status: "PUBLICADO" } },
      include: { communication: { include: { type: { select: { scoreNature: true } } } } },
    });
    // 10 - 0.2 (CPI desfavorável) + 0.2 (RE favorável) = 10
    expect(calcularNotaPublicada(items)).toBe(10);
  });
});
