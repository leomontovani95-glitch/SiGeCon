import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import path from "path";

function createPrismaClient() {
  const rawUrl = process.env.DATABASE_URL ?? "";
  let url: string;
  if (rawUrl.startsWith("file:")) {
    const filePath = rawUrl.replace("file:", "").replace("./", "");
    const abs = path.resolve(process.cwd(), filePath).replace(/\\/g, "/");
    url = `file:///${abs}`;
  } else {
    url = rawUrl;
  }
  const adapter = new PrismaLibSql({ url });
  return new PrismaClient({ adapter });
}

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };
export const prisma = globalForPrisma.prisma || createPrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
