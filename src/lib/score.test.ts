import { describe, it, expect } from "vitest";
import { calcularNotaPublicada, faixaNota, zonaDeRisco } from "./score";

// Helper para montar itens no formato esperado.
const item = (score: number | null, nature: "DESFAVORAVEL" | "FAVORAVEL") => ({
  score,
  communication: { type: { scoreNature: nature } },
});

describe("calcularNotaPublicada", () => {
  it("retorna 10 sem itens", () => {
    expect(calcularNotaPublicada([])).toBe(10);
  });

  it("subtrai itens desfavoráveis", () => {
    expect(calcularNotaPublicada([item(0.4, "DESFAVORAVEL")])).toBe(9.6);
  });

  it("soma itens favoráveis (pode passar de 10)", () => {
    expect(calcularNotaPublicada([item(0.2, "FAVORAVEL"), item(1, "FAVORAVEL")])).toBe(11.2);
  });

  it("ignora itens com score nulo", () => {
    expect(calcularNotaPublicada([item(null, "DESFAVORAVEL"), item(0.4, "DESFAVORAVEL")])).toBe(9.6);
  });

  it("usa o módulo do score (sinal vem do scoreNature, não do valor armazenado)", () => {
    // score negativo gravado em item DESFAVORAVEL ainda DESCONTA (abs + nature)
    expect(calcularNotaPublicada([item(-0.2, "DESFAVORAVEL")])).toBe(9.8);
  });

  it("combina favoráveis e desfavoráveis com arredondamento a 2 casas", () => {
    const nota = calcularNotaPublicada([
      item(0.1, "DESFAVORAVEL"),
      item(0.2, "DESFAVORAVEL"),
      item(0.2, "FAVORAVEL"),
    ]);
    expect(nota).toBe(9.9);
  });
});

describe("faixaNota", () => {
  it("classifica pelas faixas", () => {
    expect(faixaNota(9.5).label).toBe("Excelente");
    expect(faixaNota(9).label).toBe("Excelente");
    expect(faixaNota(8).label).toBe("Bom");
    expect(faixaNota(7).label).toBe("Regular");
    expect(faixaNota(6).label).toBe("Atenção");
    expect(faixaNota(5.99).label).toBe("Reprovado");
  });
});

describe("zonaDeRisco", () => {
  it("é verdadeiro abaixo de 7", () => {
    expect(zonaDeRisco(6.99)).toBe(true);
    expect(zonaDeRisco(7)).toBe(false);
    expect(zonaDeRisco(10)).toBe(false);
  });
});
