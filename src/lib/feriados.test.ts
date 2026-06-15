import { describe, it, expect } from "vitest";
import { ehFeriado } from "./feriados";

const d = (y: number, m: number, day: number) => new Date(y, m - 1, day);

describe("ehFeriado", () => {
  it("reconhece feriados nacionais fixos (em qualquer ano)", () => {
    expect(ehFeriado(d(2026, 1, 1))).toBe(true);   // Confraternização
    expect(ehFeriado(d(2026, 11, 20))).toBe(true);  // Consciência Negra
    expect(ehFeriado(d(2027, 12, 25))).toBe(true);  // Natal
  });

  it("reconhece o feriado estadual do ES (23/05)", () => {
    expect(ehFeriado(d(2026, 5, 23))).toBe(true);
  });

  it("não marca dia comum nem feriado MÓVEL (não incluídos)", () => {
    expect(ehFeriado(d(2026, 6, 10))).toBe(false);  // dia comum
    expect(ehFeriado(d(2026, 4, 3))).toBe(false);   // Sexta-feira Santa 2026 (móvel)
  });
});
