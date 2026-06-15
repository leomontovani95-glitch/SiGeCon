import { describe, it, expect, afterEach } from "vitest";
import { validarEnv } from "./env";

const orig = { ...process.env };
afterEach(() => { process.env = { ...orig }; });

describe("validarEnv", () => {
  it("não lança quando as obrigatórias estão presentes", () => {
    process.env.SESSION_SECRET = "abc";
    process.env.DATABASE_URL = "file:./x.db";
    expect(() => validarEnv()).not.toThrow();
  });

  it("lança citando a variável ausente", () => {
    process.env.SESSION_SECRET = "abc";
    delete process.env.DATABASE_URL;
    expect(() => validarEnv()).toThrow(/DATABASE_URL/);
  });

  it("trata string vazia como ausente", () => {
    process.env.SESSION_SECRET = "   ";
    process.env.DATABASE_URL = "file:./x.db";
    expect(() => validarEnv()).toThrow(/SESSION_SECRET/);
  });
});
