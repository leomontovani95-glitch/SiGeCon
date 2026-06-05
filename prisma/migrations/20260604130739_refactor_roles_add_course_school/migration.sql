-- AlterTable
ALTER TABLE "Course" ADD COLUMN "school" TEXT;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "fullName" TEXT NOT NULL,
    "warName" TEXT NOT NULL,
    "rank" TEXT NOT NULL,
    "rg" TEXT NOT NULL,
    "functionalNumber" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'PROTOCOLO',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_User" ("active", "createdAt", "email", "fullName", "functionalNumber", "id", "passwordHash", "rank", "rg", "role", "updatedAt", "warName") SELECT "active", "createdAt", "email", "fullName", "functionalNumber", "id", "passwordHash", "rank", "rg", "role", "updatedAt", "warName" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_rg_key" ON "User"("rg");
CREATE UNIQUE INDEX "User_functionalNumber_key" ON "User"("functionalNumber");
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
