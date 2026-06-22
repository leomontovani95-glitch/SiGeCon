import { describe, it, expect } from "vitest";
import { Prisma } from "@prisma/client";
import { isUniqueViolation, isBancoOcupado } from "./db-erros";

describe("isUniqueViolation", () => {
  it("reconhece a colisão @unique (P2002)", () => {
    const e = new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
      code: "P2002",
      clientVersion: "test",
    });
    expect(isUniqueViolation(e)).toBe(true);
  });

  it("ignora outros códigos do Prisma", () => {
    const e = new Prisma.PrismaClientKnownRequestError("Not found", {
      code: "P2025",
      clientVersion: "test",
    });
    expect(isUniqueViolation(e)).toBe(false);
  });

  it("ignora erro genérico e não-erro", () => {
    expect(isUniqueViolation(new Error("qualquer"))).toBe(false);
    expect(isUniqueViolation("texto")).toBe(false);
    expect(isUniqueViolation(undefined)).toBe(false);
  });
});

describe("isBancoOcupado", () => {
  it("reconhece 'database is locked' (qualquer caixa)", () => {
    expect(isBancoOcupado(new Error("database is locked"))).toBe(true);
    expect(isBancoOcupado(new Error("SQLITE_BUSY: database is locked"))).toBe(true);
    expect(isBancoOcupado(new Error("Database Is Locked"))).toBe(true);
  });

  it("reconhece o lock embrulhado na cadeia de causas", () => {
    const raiz = new Error("SQLITE_BUSY");
    const meio = new Error("falha na transação", { cause: raiz });
    const topo = new Error("erro ao gravar", { cause: meio });
    expect(isBancoOcupado(topo)).toBe(true);
  });

  it("não confunde com erros não relacionados", () => {
    expect(isBancoOcupado(new Error("constraint failed"))).toBe(false);
    expect(isBancoOcupado(new Error("timeout"))).toBe(false);
    expect(isBancoOcupado("texto qualquer")).toBe(false);
    expect(isBancoOcupado(undefined)).toBe(false);
  });

  it("não entra em loop com cadeia de causas cíclica", () => {
    const a = new Error("a") as Error & { cause?: unknown };
    const b = new Error("b") as Error & { cause?: unknown };
    a.cause = b;
    b.cause = a;
    expect(isBancoOcupado(a)).toBe(false);
  });
});
