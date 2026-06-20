import { describe, it, expect } from "vitest";
import { ehCpi1Metade, pontuacaoAutomatica, OBS_CPI1_METADE } from "./pontuacao";

describe("ehCpi1Metade", () => {
  it("verdadeiro só para Art. 146, I", () => {
    expect(ehCpi1Metade("146", "I")).toBe(true);
    expect(ehCpi1Metade("146", "II")).toBe(false);
    expect(ehCpi1Metade("142", "I")).toBe(false);
    expect(ehCpi1Metade(null, null)).toBe(false);
  });
});

describe("pontuacaoAutomatica", () => {
  it("usa o score do tipo, exceto Art. 146, I (metade)", () => {
    expect(pontuacaoAutomatica(0.2, "142", "I")).toBe(0.2); // CPI 1 normal
    expect(pontuacaoAutomatica(0.2, "146", "I")).toBe(0.1); // CPI 1 — metade
    expect(pontuacaoAutomatica(0.4, "142", "II")).toBe(0.4); // CPI 2
    expect(pontuacaoAutomatica(0.6, "142", "III")).toBe(0.6); // CPI 3
    expect(pontuacaoAutomatica(1, "170", "II")).toBe(1); // Elogio em BI
  });
  it("reflete mudança do score do tipo (metade acompanha)", () => {
    // Se a CPI 1 passar a valer 0,3 na aba Tipos, o Art. 146, I vale 0,15.
    expect(pontuacaoAutomatica(0.3, "146", "I")).toBe(0.15);
  });
  it("evita ruído de ponto flutuante", () => {
    expect(pontuacaoAutomatica(0.1, "146", "I")).toBe(0.05);
  });
});

describe("OBS_CPI1_METADE", () => {
  it("é o texto curto da observação no caderno", () => {
    expect(OBS_CPI1_METADE).toBe("50% da pont. de CPI 1");
  });
});
