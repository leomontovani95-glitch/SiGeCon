// Normalização única: coloca fullName e warName de usuários e alunos em
// MAIÚSCULO, padronizando registros antigos. Idempotente — pode rodar de novo
// sem efeito se já estiver tudo em maiúsculo. Uso: npx tsx prisma/normalizar-nomes.ts
import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import path from "path";

const envUrl = process.env.DATABASE_URL;
const fileRel = envUrl?.startsWith("file:")
  ? envUrl.replace(/^file:/, "").replace(/^\.\//, "")
  : "dev.db";
const dbPath = path.resolve(process.cwd(), fileRel).replace(/\\/g, "/");
const adapter = new PrismaLibSql({ url: `file:///${dbPath}` });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log(`🔠 Normalizando nomes para MAIÚSCULO em ${fileRel} ...`);

  let usuarios = 0;
  for (const u of await prisma.user.findMany({ select: { id: true, fullName: true, warName: true } })) {
    const fullName = u.fullName.toUpperCase();
    const warName = u.warName.toUpperCase();
    if (fullName !== u.fullName || warName !== u.warName) {
      await prisma.user.update({ where: { id: u.id }, data: { fullName, warName } });
      usuarios++;
    }
  }
  console.log(`✅ Usuários atualizados: ${usuarios}`);

  let alunos = 0;
  for (const a of await prisma.student.findMany({ select: { id: true, fullName: true, warName: true } })) {
    const fullName = a.fullName.toUpperCase();
    const warName = a.warName.toUpperCase();
    if (fullName !== a.fullName || warName !== a.warName) {
      await prisma.student.update({ where: { id: a.id }, data: { fullName, warName } });
      alunos++;
    }
  }
  console.log(`✅ Alunos atualizados: ${alunos}`);
  console.log("🎉 Normalização concluída.");
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
