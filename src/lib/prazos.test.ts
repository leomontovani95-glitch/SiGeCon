import { describe, it, expect } from "vitest";
import { calcularPrazoDefesa, prazoExpirado } from "./prazos";

// Helpers de data local (mês 0-indexado).
const d = (y: number, m: number, day: number) => new Date(y, m - 1, day);
const ymd = (date: Date) => [date.getFullYear(), date.getMonth() + 1, date.getDate()];

describe("calcularPrazoDefesa (2 dias úteis)", () => {
  it("quarta-feira → sexta-feira", () => {
    // 2026-06-10 é quarta
    expect(ymd(calcularPrazoDefesa(d(2026, 6, 10)))).toEqual([2026, 6, 12]);
  });

  it("quinta-feira → segunda (pula o fim de semana)", () => {
    // 2026-06-11 quinta → sex (1) → sáb/dom pulados → seg (2) = 15
    expect(ymd(calcularPrazoDefesa(d(2026, 6, 11)))).toEqual([2026, 6, 15]);
  });

  it("sexta-feira → terça (pula o fim de semana)", () => {
    // 2026-06-12 sexta → seg (1) → ter (2) = 16
    expect(ymd(calcularPrazoDefesa(d(2026, 6, 12)))).toEqual([2026, 6, 16]);
  });

  it("pula feriado: segunda → quinta quando terça é Tiradentes (21/04)", () => {
    // 2026-04-20 segunda → ter 21/04 (feriado, pula) → qua (1) → qui (2) = 23
    expect(ymd(calcularPrazoDefesa(d(2026, 4, 20)))).toEqual([2026, 4, 23]);
  });
});

describe("prazoExpirado", () => {
  it("nulo nunca expira", () => {
    expect(prazoExpirado(null)).toBe(false);
  });
  it("data passada expira", () => {
    expect(prazoExpirado(new Date(Date.now() - 60_000))).toBe(true);
  });
  it("data futura não expira", () => {
    expect(prazoExpirado(new Date(Date.now() + 60_000))).toBe(false);
  });
});
