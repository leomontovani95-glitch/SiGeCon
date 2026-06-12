import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import path from "path";
const dbPath = path.resolve(process.cwd(), "dev.db").replace(/\\/g, "/");
const prisma = new PrismaClient({ adapter: new PrismaLibSql({ url: `file:///${dbPath}` }) });
prisma.communicationType.findMany({ select: { name: true, scoreNature: true } })
  .then(r => { console.log(JSON.stringify(r, null, 2)); })
  .finally(() => prisma.$disconnect());
