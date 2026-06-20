import { describe, it, expect } from "vitest";
import { pontuacaoAutomatica, OBS_CPI1_METADE } from "./pontuacao";

describe("pontuacaoAutomatica", () => {
  it("usa o score do tipo quando não é metade", () => {
    expect(pontuacaoAutomatica(0.2, false)).toBe(0.2); // CPI 1 normal
    expect(pontuacaoAutomatica(0.4, false)).toBe(0.4); // CPI 2
    expect(pontuacaoAutomatica(0.6, false)).toBe(0.6); // CPI 3
    expect(pontuacaoAutomatica(1, false)).toBe(1); // Elogio em BI
  });
  it("aplica metade quando o dispositivo é 50% da CPI 1", () => {
    expect(pontuacaoAutomatica(0.2, true)).toBe(0.1);
  });
  it("reflete mudança do score do tipo (metade acompanha)", () => {
    // Se a CPI 1 passar a valer 0,3 na aba Tipos, o dispositivo de metade vale 0,15.
    expect(pontuacaoAutomatica(0.3, true)).toBe(0.15);
  });
  it("evita ruído de ponto flutuante", () => {
    expect(pontuacaoAutomatica(0.1, true)).toBe(0.05);
  });
});

describe("OBS_CPI1_METADE", () => {
  it("é o texto curto da observação no caderno", () => {
    expect(OBS_CPI1_METADE).toBe("50% da pont. de CPI 1");
  });
});
