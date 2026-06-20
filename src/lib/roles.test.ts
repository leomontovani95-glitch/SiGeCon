import { describe, it, expect } from "vitest";
import {
  effectiveRoles,
  canDecide,
  canEmitOpinion,
  canManageCaderno,
  canChangeBookDecision,
  canManageUserRole,
  manageableRoles,
  getSchoolFilter,
  escolaNoEscopo,
  cursosPermitidosParaCPI,
} from "./roles";

describe("effectiveRoles", () => {
  it("combina papel primário e adicionais", () => {
    expect(effectiveRoles({ role: "PROTOCOLO", additionalRoles: "OFICIAL_ESFAP, CHEFE_CURSO" }))
      .toEqual(["PROTOCOLO", "OFICIAL_ESFAP", "CHEFE_CURSO"]);
  });
  it("sem adicionais retorna só o primário", () => {
    expect(effectiveRoles({ role: "ALUNO" })).toEqual(["ALUNO"]);
    expect(effectiveRoles({ role: "ALUNO", additionalRoles: "" })).toEqual(["ALUNO"]);
  });
});

describe("canDecide / canEmitOpinion", () => {
  it("comandante decide; oficial não", () => {
    expect(canDecide("COMANDANTE_ESFAP")).toBe(true);
    expect(canDecide("OFICIAL_ESFAP")).toBe(false);
  });
  it("parecerista emite parecer; comandante não", () => {
    expect(canEmitOpinion("OFICIAL_ESFO")).toBe(true);
    expect(canEmitOpinion("COMANDANTE_ESFO")).toBe(false);
  });
  it("considera funções adicionais", () => {
    expect(canDecide("PROTOCOLO", "COMANDANTE_ESFAP")).toBe(true);
  });
});

describe("canManageCaderno (gestão de caderno: Oficial→Comandante + Admin/Div.Acad.)", () => {
  it("oficial, subcomandante, comandante e admin/div.acad. gerenciam", () => {
    for (const r of [
      "OFICIAL_ESFAP", "OFICIAL_ESFO", "SUBCOMANDANTE_ESFAP", "SUBCOMANDANTE_ESFO",
      "COMANDANTE_ESFAP", "COMANDANTE_ESFO", "ADMINISTRADOR", "CHEFE_DIVISAO_ACADEMICA",
    ]) {
      expect(canManageCaderno(r)).toBe(true);
    }
  });
  it("protocolo, chefe de curso e aluno NÃO gerenciam", () => {
    expect(canManageCaderno("PROTOCOLO")).toBe(false);
    expect(canManageCaderno("CHEFE_CURSO")).toBe(false);
    expect(canManageCaderno("ALUNO")).toBe(false);
  });
  it("considera funções adicionais", () => {
    expect(canManageCaderno("PROTOCOLO", "OFICIAL_ESFO")).toBe(true);
  });
});

describe("canChangeBookDecision (alterar decisão: só Comandante de Escola + Admin)", () => {
  it("comandantes de escola e admin podem", () => {
    expect(canChangeBookDecision("COMANDANTE_ESFAP")).toBe(true);
    expect(canChangeBookDecision("COMANDANTE_ESFO")).toBe(true);
    expect(canChangeBookDecision("ADMINISTRADOR")).toBe(true);
  });
  it("oficial, subcomandante e chefe da div. acadêmica NÃO podem", () => {
    expect(canChangeBookDecision("OFICIAL_ESFAP")).toBe(false);
    expect(canChangeBookDecision("SUBCOMANDANTE_ESFO")).toBe(false);
    expect(canChangeBookDecision("CHEFE_DIVISAO_ACADEMICA")).toBe(false);
  });
});

describe("canManageUserRole (nível: mesmo e abaixo)", () => {
  it("admin gerencia qualquer função gerenciável", () => {
    expect(canManageUserRole("ADMINISTRADOR", "PROTOCOLO")).toBe(true);
    expect(canManageUserRole("ADMINISTRADOR", "COMANDANTE_ESFO")).toBe(true);
  });
  it("não gerencia acima do próprio nível", () => {
    expect(canManageUserRole("CHEFE_CURSO", "ADMINISTRADOR")).toBe(false);
  });
  it("permite gestão lateral (mesmo nível) — comportamento intencional atual", () => {
    expect(canManageUserRole("COMANDANTE_ESFAP", "COMANDANTE_ESFO")).toBe(true);
  });
  it("papel desconhecido ou não-gestor não gerencia", () => {
    expect(canManageUserRole("ALUNO", "PROTOCOLO")).toBe(false);
    expect(canManageUserRole("FOO", "PROTOCOLO")).toBe(false);
  });
  it("manageableRoles do admin inclui PROTOCOLO e exclui o que não é gerenciável", () => {
    expect(manageableRoles("ADMINISTRADOR")).toContain("PROTOCOLO");
    expect(manageableRoles("CHEFE_CURSO")).not.toContain("ADMINISTRADOR");
  });
});

describe("getSchoolFilter", () => {
  it("papel força a escola", () => {
    expect(getSchoolFilter("OFICIAL_ESFAP", "TODAS")).toBe("ESFAP");
    expect(getSchoolFilter("COMANDANTE_ESFO", null)).toBe("ESFO");
  });
  it("sem papel de escola, usa o campo escola do usuário", () => {
    expect(getSchoolFilter("PROTOCOLO", "ESFAP")).toBe("ESFAP");
    expect(getSchoolFilter("PROTOCOLO", "TODAS")).toBeNull();
    expect(getSchoolFilter("ADMINISTRADOR", "TODAS")).toBeNull();
  });
});

describe("escolaNoEscopo", () => {
  it("escopo nulo (global) acessa qualquer escola", () => {
    expect(escolaNoEscopo({ role: "ADMINISTRADOR", escola: "TODAS" }, "ESFO")).toBe(true);
  });
  it("escopo restrito só acessa a própria escola", () => {
    expect(escolaNoEscopo({ role: "OFICIAL_ESFAP", escola: "ESFAP" }, "ESFAP")).toBe(true);
    expect(escolaNoEscopo({ role: "OFICIAL_ESFAP", escola: "ESFAP" }, "ESFO")).toBe(false);
  });
});

describe("cursosPermitidosParaCPI (hierarquia EsFO)", () => {
  const cursos = [
    { id: "esfap1", name: "CFSd 2026", school: "ESFAP" },
    { id: "cfo1", name: "CFO 1", school: "ESFO" },
    { id: "cfo2", name: "CFO 2", school: "ESFO" },
    { id: "cfo3", name: "CFO 3", school: "ESFO" },
  ];
  it("CFO 2 comunica ESFAP e CFO de posto inferior (CFO 1), mas não iguais/superiores", () => {
    const ids = cursosPermitidosParaCPI("CFO 2", cursos);
    expect(ids).toContain("esfap1");
    expect(ids).toContain("cfo1");
    expect(ids).not.toContain("cfo2");
    expect(ids).not.toContain("cfo3");
  });
  it("curso fora da hierarquia EsFO não comunica nada", () => {
    expect(cursosPermitidosParaCPI("CFSd 2026", cursos)).toEqual([]);
  });
});
