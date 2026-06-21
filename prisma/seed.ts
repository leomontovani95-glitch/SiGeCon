import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import bcrypt from "bcryptjs";
import path from "path";
import { readFileSync } from "fs";

// Caminho do banco: por padrão dev.db (instalação nova via `npm run setup`).
// Permite sobrescrever via DATABASE_URL=file:./outro.db para testes isolados.
const envUrl = process.env.DATABASE_URL;
const fileRel = envUrl?.startsWith("file:")
  ? envUrl.replace(/^file:/, "").replace(/^\.\//, "")
  : "dev.db";
const dbPath = path.resolve(process.cwd(), fileRel).replace(/\\/g, "/");
const adapter = new PrismaLibSql({ url: `file:///${dbPath}` });
const prisma = new PrismaClient({ adapter });

// Dados de referência versionados no repositório (exportados do banco). Mantêm a
// instalação nova já com a legislação e os tipos prontos — e continuam editáveis
// e excluíveis pela aplicação (o seed só cria o que estiver faltando).
type TypeData = { name: string; description: string | null; score: number; scoreNature: string; active: boolean };
type RuleData = {
  id: string; article: string; item: string | null; letter: string | null;
  description: string; theme: string | null;
  defaultCommunicationType: string | null; defaultScore: number | null;
  halfCpi1: boolean; active: boolean;
};
const dataDir = path.resolve(process.cwd(), "prisma/seed-data");
const tipos: TypeData[] = JSON.parse(readFileSync(path.join(dataDir, "communication-types.json"), "utf8"));
const regras: RuleData[] = JSON.parse(readFileSync(path.join(dataDir, "manual-rules.json"), "utf8"));

async function main() {
  console.log("🌱 Iniciando seed do SiGeCon...");

  // ── Administrador (único usuário criado) ────────────────────────────────────
  // Login pelo Número Funcional "000000". Troca de senha obrigatória no 1º acesso.
  const hashAdmin = await bcrypt.hash("Admin@2026", 10);
  await prisma.user.upsert({
    where: { email: "admin@sigecone.mil.br" },
    update: {},
    create: {
      email: "admin@sigecone.mil.br",
      passwordHash: hashAdmin,
      fullName: "Administrador do Sistema",
      warName: "ADMIN",
      rank: "Cap",
      rg: "000000",
      functionalNumber: "000000",
      role: "ADMINISTRADOR",
      escola: "TODAS",
      active: true,
      mustChangePassword: true,
    },
  });
  console.log("✅ Administrador criado/verificado");

  // ── Tipos de comunicação ────────────────────────────────────────────────────
  for (const t of tipos) {
    await prisma.communicationType.upsert({ where: { name: t.name }, update: {}, create: t });
  }
  console.log(`✅ Tipos de comunicação criados/verificados (${tipos.length})`);

  // ── Manual do Aluno (dispositivos legais) ───────────────────────────────────
  for (const r of regras) {
    await prisma.manualRule.upsert({ where: { id: r.id }, update: {}, create: r });
  }
  console.log(`✅ Manual do Aluno criado/verificado (${regras.length} dispositivos)`);

  console.log("\n🎉 Seed concluído com sucesso!");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  ACESSO INICIAL — SiGeCon");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  Administrador");
  console.log("  Número Funcional: 000000");
  console.log("  Senha inicial:    Admin@2026  (troca obrigatória no 1º acesso)");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  Demais usuários, cursos e alunos são cadastrados pelo Admin.");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
