import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import bcrypt from "bcryptjs";
import path from "path";

const dbPath = path.resolve(process.cwd(), "dev.db").replace(/\\/g, "/");
const adapter = new PrismaLibSql({ url: `file:///${dbPath}` });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🌱 Iniciando seed do SiGeCon...");

  const hashAdmin = await bcrypt.hash("Admin@2026", 10);
  const hashPadrao = await bcrypt.hash("SiGeCon@2026", 10);

  // ── Usuários ───────────────────────────────────────────────────────────────
  const usuarios = [
    {
      email: "admin@sigecone.mil.br",
      passwordHash: hashAdmin,
      fullName: "Administrador do Sistema",
      warName: "ADMIN",
      rank: "Cap",
      rg: "000000",
      functionalNumber: "000000",
      role: "ADMINISTRADOR",
    },
    {
      email: "cmd.esfap@sigecone.mil.br",
      passwordHash: hashPadrao,
      fullName: "Comandante da EsFAP",
      warName: "CMD ESFAP",
      rank: "TC",
      rg: "100001",
      functionalNumber: "100001",
      role: "COMANDANTE_ESFAP",
    },
    {
      email: "cmd.esfo@sigecone.mil.br",
      passwordHash: hashPadrao,
      fullName: "Comandante da EsFO",
      warName: "CMD ESFO",
      rank: "TC",
      rg: "100002",
      functionalNumber: "100002",
      role: "COMANDANTE_ESFO",
    },
    {
      email: "chefe.acad@sigecone.mil.br",
      passwordHash: hashPadrao,
      fullName: "Chefe da Divisão Acadêmica",
      warName: "CH DIV ACAD",
      rank: "Maj",
      rg: "100003",
      functionalNumber: "100003",
      role: "CHEFE_DIVISAO_ACADEMICA",
    },
    {
      email: "sub.esfap@sigecone.mil.br",
      passwordHash: hashPadrao,
      fullName: "Subcomandante da EsFAP",
      warName: "SUB ESFAP",
      rank: "Maj",
      rg: "100004",
      functionalNumber: "100004",
      role: "SUBCOMANDANTE_ESFAP",
    },
    {
      email: "sub.esfo@sigecone.mil.br",
      passwordHash: hashPadrao,
      fullName: "Subcomandante da EsFO",
      warName: "SUB ESFO",
      rank: "Maj",
      rg: "100005",
      functionalNumber: "100005",
      role: "SUBCOMANDANTE_ESFO",
    },
    {
      email: "of.esfap@sigecone.mil.br",
      passwordHash: hashPadrao,
      fullName: "Oficial da EsFAP",
      warName: "OF ESFAP",
      rank: "Cap",
      rg: "100006",
      functionalNumber: "100006",
      role: "OFICIAL_ESFAP",
    },
    {
      email: "of.esfo@sigecone.mil.br",
      passwordHash: hashPadrao,
      fullName: "Oficial da EsFO",
      warName: "OF ESFO",
      rank: "Cap",
      rg: "100007",
      functionalNumber: "100007",
      role: "OFICIAL_ESFO",
    },
    {
      email: "chefe.curso@sigecone.mil.br",
      passwordHash: hashPadrao,
      fullName: "Chefe de Curso",
      warName: "CH CURSO",
      rank: "Ten",
      rg: "100008",
      functionalNumber: "100008",
      role: "CHEFE_CURSO",
    },
    {
      email: "protocolo@sigecone.mil.br",
      passwordHash: hashPadrao,
      fullName: "Setor de Protocolo",
      warName: "PROTOCOLO",
      rank: "ST",
      rg: "100009",
      functionalNumber: "100009",
      role: "PROTOCOLO",
    },
  ];

  for (const u of usuarios) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: { ...u, active: true },
    });
  }
  console.log(`✅ ${usuarios.length} usuário(s) criado(s)/verificado(s)`);

  // ── Tipos de comunicação (NPCE 2025) ───────────────────────────────────────
  const tipos = [
    { name: "CPI 1", score: 0.2, scoreNature: "DESFAVORAVEL", description: "CPI de primeiro grau" },
    { name: "CPI 2", score: 0.4, scoreNature: "DESFAVORAVEL", description: "CPI de segundo grau" },
    { name: "CPI 3", score: 0.6, scoreNature: "DESFAVORAVEL", description: "CPI de terceiro grau" },
    { name: "Referência Elogiosa", score: 0.2, scoreNature: "FAVORAVEL", description: "Referência elogiosa registrada" },
    { name: "Elogio publicado em BI", score: 1.0, scoreNature: "FAVORAVEL", description: "Elogio publicado em Boletim Interno" },
    { name: "Arquivamento", score: 0, scoreNature: "DESFAVORAVEL", description: "Registro arquivado sem pontuação" },
  ];
  for (const t of tipos) {
    await prisma.communicationType.upsert({ where: { name: t.name }, update: {}, create: t });
  }
  console.log("✅ Tipos de comunicação criados/verificados (NPCE 2025)");

  // ── Manual do Aluno ────────────────────────────────────────────────────────
  await prisma.manualRule.upsert({
    where: { id: "manual-146-i" },
    update: {},
    create: {
      id: "manual-146-i",
      article: "146",
      item: "I",
      letter: null,
      description: "Fardamento em desalinho",
      defaultCommunicationType: "CPI 1",
      defaultScore: 0.1,
      active: true,
    },
  });
  console.log("✅ Dispositivo do Manual (Art. 146, Inc. I) criado/verificado");

  // ── Cursos (com campo school) ──────────────────────────────────────────────
  const cursosData = [
    { name: "CFO 1",      acronym: "CFO1",   year: 2024, school: "ESFO" },
    { name: "CFO 2",      acronym: "CFO2",   year: 2025, school: "ESFO" },
    { name: "CFO 3",      acronym: "CFO3",   year: 2026, school: "ESFO" },
    { name: "CHS",        acronym: "CHS",    year: 2026, school: "ESFAP", description: "Curso de Habilitação de Sargentos" },
    { name: "CFSd 2026",  acronym: "CFSd26", year: 2026, school: "ESFAP" },
    { name: "CFSd 2027",  acronym: "CFSd27", year: 2027, school: "ESFAP" },
    { name: "CFSd 2028",  acronym: "CFSd28", year: 2028, school: "ESFAP" },
    { name: "CFSd 2029",  acronym: "CFSd29", year: 2029, school: "ESFAP" },
    { name: "CFSd 2030",  acronym: "CFSd30", year: 2030, school: "ESFAP" },
  ];

  const cursos: Record<string, string> = {};
  for (const c of cursosData) {
    const existente = await prisma.course.findFirst({ where: { name: c.name } });
    const curso = existente
      ? await prisma.course.update({ where: { id: existente.id }, data: { school: c.school } })
      : await prisma.course.create({ data: { ...c, active: true } });
    cursos[c.name] = curso.id;
  }
  console.log("✅ Cursos criados/atualizados:", Object.keys(cursos).join(", "));

  // ── Pelotões de exemplo (só cria se não existirem) ─────────────────────────
  const cfo1Id = cursos["CFO 1"];
  const existentes = await prisma.platoon.count({ where: { courseId: cfo1Id } });
  if (existentes === 0) {
    await prisma.platoon.create({ data: { name: "1º Pelotão", courseId: cfo1Id, active: true } });
    await prisma.platoon.create({ data: { name: "2º Pelotão", courseId: cfo1Id, active: true } });
    console.log("✅ Pelotões de exemplo criados");
  }

  // ── Alunos de exemplo ──────────────────────────────────────────────────────
  const pelotoes = await prisma.platoon.findMany({ where: { courseId: cfo1Id } });
  const [p1, p2] = pelotoes;
  if (p1 && p2) {
    const alunosData = [
      { fullName: "João Pedro Almeida",    warName: "ALMEIDA", courseId: cfo1Id, courseNumber: "001", platoonId: p1.id, rg: "1234567", status: "ATIVO" },
      { fullName: "Carlos Eduardo Silva",  warName: "SILVA",   courseId: cfo1Id, courseNumber: "002", platoonId: p1.id, rg: "2345678", status: "ATIVO" },
      { fullName: "Marcos Roberto Costa",  warName: "COSTA",   courseId: cfo1Id, courseNumber: "003", platoonId: p2.id, rg: "3456789", status: "ATIVO" },
      { fullName: "Felipe Augusto Souza",  warName: "SOUZA",   courseId: cfo1Id, courseNumber: "004", platoonId: p2.id, rg: "4567890", status: "ATIVO" },
    ];
    for (const a of alunosData) {
      // rg deixou de ser único (a mesma pessoa pode ter vários cadastros);
      // mantém idempotência verificando existência antes de criar.
      const existe = await prisma.student.findFirst({ where: { rg: a.rg } });
      if (!existe) await prisma.student.create({ data: a });
    }
    console.log("✅ Alunos de exemplo criados/verificados");
  }

  console.log("\n🎉 Seed concluído com sucesso!");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  CREDENCIAIS DE ACESSO — SiGeCon");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  FUNÇÃO                       E-MAIL                          SENHA");
  console.log("  Administrador                admin@sigecone.mil.br           Admin@2026");
  console.log("  Comandante da EsFAP          cmd.esfap@sigecone.mil.br       SiGeCon@2026");
  console.log("  Comandante da EsFO           cmd.esfo@sigecone.mil.br        SiGeCon@2026");
  console.log("  Chefe da Div. Acadêmica      chefe.acad@sigecone.mil.br      SiGeCon@2026");
  console.log("  Subcomandante da EsFAP       sub.esfap@sigecone.mil.br       SiGeCon@2026");
  console.log("  Subcomandante da EsFO        sub.esfo@sigecone.mil.br        SiGeCon@2026");
  console.log("  Oficial da EsFAP             of.esfap@sigecone.mil.br        SiGeCon@2026");
  console.log("  Oficial da EsFO              of.esfo@sigecone.mil.br         SiGeCon@2026");
  console.log("  Chefe de Curso               chefe.curso@sigecone.mil.br     SiGeCon@2026");
  console.log("  Setor de Protocolo           protocolo@sigecone.mil.br       SiGeCon@2026");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
