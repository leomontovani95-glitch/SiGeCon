import { describe, it, expect } from "vitest";
import {
  normalizeSituacaoCurso,
  activeWhereCurso,
  courseScopeWhere,
  studentStatusWhere,
  buildSituacaoOptions,
  SITUACAO_CURSO_OPTS,
} from "./cursos";

describe("normalizeSituacaoCurso", () => {
  it("aceita inativos e todos; qualquer outro valor cai em ativos", () => {
    expect(normalizeSituacaoCurso("inativos")).toBe("inativos");
    expect(normalizeSituacaoCurso("todos")).toBe("todos");
    expect(normalizeSituacaoCurso("ativos")).toBe("ativos");
    expect(normalizeSituacaoCurso(undefined)).toBe("ativos");
    expect(normalizeSituacaoCurso("")).toBe("ativos");
    expect(normalizeSituacaoCurso("lixo")).toBe("ativos");
  });
});

describe("activeWhereCurso", () => {
  it("trava o booleano em ativos/inativos e não filtra em todos", () => {
    expect(activeWhereCurso("ativos")).toEqual({ active: true });
    expect(activeWhereCurso("inativos")).toEqual({ active: false });
    expect(activeWhereCurso("todos")).toEqual({});
  });
});

describe("studentStatusWhere", () => {
  it("alinha o status do aluno à situação do curso", () => {
    expect(studentStatusWhere("ativos")).toEqual({ status: "ATIVO" });
    expect(studentStatusWhere("inativos")).toEqual({ status: "INATIVO" });
    expect(studentStatusWhere("todos")).toEqual({});
  });
});

describe("courseScopeWhere", () => {
  it("cursoId específico vence escola e situação", () => {
    expect(courseScopeWhere("ativos", "ESFO", "abc")).toEqual({ courseId: "abc" });
    expect(courseScopeWhere("inativos", null, "abc")).toEqual({ courseId: "abc" });
  });
  it("sem cursoId, combina escola + situação na relação course", () => {
    expect(courseScopeWhere("ativos", "ESFO")).toEqual({ course: { school: "ESFO", active: true } });
    expect(courseScopeWhere("inativos", "ESFAP")).toEqual({ course: { school: "ESFAP", active: false } });
  });
  it("sem escola, filtra só por situação", () => {
    expect(courseScopeWhere("ativos", null)).toEqual({ course: { active: true } });
    expect(courseScopeWhere("inativos", null)).toEqual({ course: { active: false } });
  });
  it("todos sem escola não filtra nada", () => {
    expect(courseScopeWhere("todos", null)).toEqual({});
  });
  it("todos com escola filtra só pela escola", () => {
    expect(courseScopeWhere("todos", "ESFO")).toEqual({ course: { school: "ESFO" } });
  });
});

describe("buildSituacaoOptions", () => {
  it("gera uma opção por situação, marcando a ativa e usando o href fornecido", () => {
    const opts = buildSituacaoOptions("inativos", (k) => `/x?situacao=${k}`);
    expect(opts).toHaveLength(SITUACAO_CURSO_OPTS.length);
    expect(opts.map((o) => o.key)).toEqual(["ativos", "inativos", "todos"]);
    expect(opts.find((o) => o.key === "inativos")?.active).toBe(true);
    expect(opts.find((o) => o.key === "ativos")?.active).toBe(false);
    expect(opts.find((o) => o.key === "todos")?.href).toBe("/x?situacao=todos");
  });
});
