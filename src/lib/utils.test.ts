import { describe, it, expect } from "vitest";
import { dataLocalISO, abreviarPelotao, platoonOrder, maskRG } from "./utils";

describe("maskRG", () => {
  it("formata 6 dígitos no padrão PMES XX.XXX-X", () => {
    expect(maskRG("231936")).toBe("23.193-6");
    expect(maskRG("200000")).toBe("20.000-0");
  });
  it("é idempotente para valor já formatado", () => {
    expect(maskRG("23.193-6")).toBe("23.193-6");
  });
  it("ignora não-dígitos digitados", () => {
    expect(maskRG("23a19-3 6")).toBe("23.193-6");
  });
  it("formata parcial enquanto digita (sem travar)", () => {
    expect(maskRG("23")).toBe("2-3");
    expect(maskRG("2319")).toBe("231-9");
  });
  it("não perde dígitos de RGs com 7 (agrupa à esquerda)", () => {
    expect(maskRG("1234567")).toBe("123.456-7");
  });
  it("string vazia retorna vazio", () => {
    expect(maskRG("")).toBe("");
    expect(maskRG(null)).toBe("");
  });
});

describe("dataLocalISO", () => {
  it("retorna a data LOCAL do Date informado (não desliza para UTC)", () => {
    // 14/06/2026 22:00 no fuso local. Em UTC-3, toISOString daria 2026-06-15;
    // dataLocalISO deve manter o dia local 14.
    expect(dataLocalISO(new Date(2026, 5, 14, 22, 0, 0))).toBe("2026-06-14");
    expect(dataLocalISO(new Date(2026, 0, 5, 3, 0, 0))).toBe("2026-01-05");
  });
  it("formata como YYYY-MM-DD por padrão", () => {
    expect(dataLocalISO()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("abreviarPelotao / platoonOrder", () => {
  it("abrevia Pelotão e ordena por número", () => {
    expect(abreviarPelotao("2º Pelotão")).toBe("2º Pel");
    expect(abreviarPelotao(null)).toBe("—");
    expect(platoonOrder("3º Pelotão")).toBe(3);
    expect(platoonOrder(null)).toBe(999);
  });
});
