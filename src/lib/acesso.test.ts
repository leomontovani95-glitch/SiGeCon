import { describe, it, expect } from "vitest";
import { acessoComunicacao, staffPodeVerAluno } from "@/lib/acesso";

// Cobre os ramos de STAFF (puros — não consultam o banco). Os ramos de ALUNO
// dependem de consulta por RG e ficam para teste de integração.
const comm = (school: string) => ({
  communicantUserId: null,
  student: { userId: "aluno-1", rg: "11.111-1", course: { school } },
});

describe("acessoComunicacao (staff)", () => {
  it("administrador acessa qualquer escola, com vista completa", async () => {
    const a = await acessoComunicacao({ userId: "u", role: "ADMINISTRADOR", escola: "TODAS" }, comm("ESFO"));
    expect(a).toEqual({ permitido: true, vistaRestrita: false });
  });

  it("oficial de uma escola não acessa comunicação da outra", async () => {
    const a = await acessoComunicacao({ userId: "u", role: "OFICIAL_ESFO", escola: "ESFO" }, comm("ESFAP"));
    expect(a.permitido).toBe(false);
  });

  it("oficial acessa comunicação da própria escola, com vista completa", async () => {
    const a = await acessoComunicacao({ userId: "u", role: "OFICIAL_ESFAP", escola: "ESFAP" }, comm("ESFAP"));
    expect(a).toEqual({ permitido: true, vistaRestrita: false });
  });

  it("Protocolo e Chefe de Curso têm vista restrita (sem decisão/parecer)", async () => {
    for (const role of ["PROTOCOLO", "CHEFE_CURSO"]) {
      const a = await acessoComunicacao({ userId: "u", role, escola: "ESFAP" }, comm("ESFAP"));
      expect(a).toEqual({ permitido: true, vistaRestrita: true });
    }
  });

  it("Protocolo vinculado a uma escola não acessa comunicação da outra", async () => {
    const a = await acessoComunicacao({ userId: "u", role: "PROTOCOLO", escola: "ESFAP" }, comm("ESFO"));
    expect(a.permitido).toBe(false);
  });
});

describe("staffPodeVerAluno", () => {
  const aluno = (school: string) => ({ rg: "11.111-1", course: { school } });

  it("usuário sem escopo de escola vê qualquer aluno", async () => {
    expect(await staffPodeVerAluno({ userId: "u", role: "CHEFE_DIVISAO_ACADEMICA", escola: "TODAS" }, aluno("ESFO"))).toBe(true);
  });

  it("usuário com escopo vê aluno da própria escola", async () => {
    expect(await staffPodeVerAluno({ userId: "u", role: "COMANDANTE_ESFO", escola: "ESFO" }, aluno("ESFO"))).toBe(true);
  });
});
