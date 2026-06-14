import { describe, it, expect } from "vitest";
import { dataLocalISO, abreviarPelotao, platoonOrder } from "./utils";

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
