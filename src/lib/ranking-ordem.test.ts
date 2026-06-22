import { describe, it, expect } from "vitest";
import { compararRanking, normalizarOrdemRanking, type LinhaRanking } from "./ranking-ordem";

const linha = (over: Partial<LinhaRanking>): LinhaRanking => ({
  warName: "X",
  courseNumber: "1",
  courseName: "CFO 1",
  platoonName: null,
  nota: 10,
  ...over,
});

function ordenar(linhas: LinhaRanking[], ordem: Parameters<typeof compararRanking>[0]) {
  return [...linhas].sort(compararRanking(ordem));
}

describe("normalizarOrdemRanking", () => {
  it("aceita valores válidos e cai no padrão (desc) para inválidos", () => {
    expect(normalizarOrdemRanking("nomeAsc")).toBe("nomeAsc");
    expect(normalizarOrdemRanking("classDesc")).toBe("classDesc");
    expect(normalizarOrdemRanking("inexistente")).toBe("desc");
    expect(normalizarOrdemRanking(undefined)).toBe("desc");
  });
});

describe("compararRanking", () => {
  const a = linha({ warName: "Alves", courseNumber: "10", platoonName: "1º Pel", nota: 8.5 });
  const b = linha({ warName: "Brito", courseNumber: "02", platoonName: "2º Pel", nota: 9.7 });
  const c = linha({ warName: "Castro", courseNumber: "30", platoonName: "1º Pel", nota: 8.5 });

  it("nota desc (maior → menor)", () => {
    expect(ordenar([a, b, c], "desc").map((x) => x.nota)).toEqual([9.7, 8.5, 8.5]);
  });

  it("nota asc (menor → maior)", () => {
    expect(ordenar([b, a, c], "asc").map((x) => x.nota)).toEqual([8.5, 8.5, 9.7]);
  });

  it("número crescente/decrescente", () => {
    expect(ordenar([a, b, c], "numAsc").map((x) => x.courseNumber)).toEqual(["02", "10", "30"]);
    expect(ordenar([a, b, c], "numDesc").map((x) => x.courseNumber)).toEqual(["30", "10", "02"]);
  });

  it("nome de guerra A→Z e Z→A", () => {
    expect(ordenar([c, a, b], "nomeAsc").map((x) => x.warName)).toEqual(["Alves", "Brito", "Castro"]);
    expect(ordenar([a, b, c], "nomeDesc").map((x) => x.warName)).toEqual(["Castro", "Brito", "Alves"]);
  });

  it("pelotão em ordem NATURAL (1º, 2º ... 9º, 10º, 11º) e não alfabética", () => {
    const p = (n: number, num: string) => linha({ platoonName: `${n}º Pel`, courseNumber: num });
    const embaralhados = [p(10, "1"), p(2, "2"), p(1, "3"), p(11, "4"), p(9, "5")];
    expect(ordenar(embaralhados, "pelAsc").map((x) => x.platoonName))
      .toEqual(["1º Pel", "2º Pel", "9º Pel", "10º Pel", "11º Pel"]);
    expect(ordenar(embaralhados, "pelDesc").map((x) => x.platoonName))
      .toEqual(["11º Pel", "10º Pel", "9º Pel", "2º Pel", "1º Pel"]);
  });

  it("curso também em ordem natural (CFO 2 antes de CFO 10)", () => {
    const c = (nome: string, num: string) => linha({ courseName: nome, courseNumber: num });
    expect(ordenar([c("CFO 10", "1"), c("CFO 2", "2"), c("CFO 1", "3")], "cursoAsc").map((x) => x.courseName))
      .toEqual(["CFO 1", "CFO 2", "CFO 10"]);
  });

  it("empate (mesma nota) é desfeito pelo número crescente", () => {
    // a e c têm nota 8.5; a=nº10, c=nº30 → a antes de c em qualquer ordem por nota
    expect(ordenar([c, a], "desc").map((x) => x.courseNumber)).toEqual(["10", "30"]);
    expect(ordenar([c, a], "classDesc").map((x) => x.courseNumber)).toEqual(["10", "30"]);
  });
});
