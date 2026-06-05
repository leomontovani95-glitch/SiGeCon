/*
  Warnings:

  - You are about to drop the column `internalNotes` on the `Communication` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Communication" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "protocolNumber" TEXT NOT NULL,
    "typeId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "courseNumber" TEXT NOT NULL,
    "platoonId" TEXT,
    "reporterId" TEXT NOT NULL,
    "factDate" DATETIME NOT NULL,
    "factTime" TEXT,
    "factPlace" TEXT,
    "factDescription" TEXT NOT NULL,
    "manualRuleId" TEXT,
    "article" TEXT,
    "item" TEXT,
    "letter" TEXT,
    "suggestedScore" REAL,
    "finalScore" REAL,
    "status" TEXT NOT NULL DEFAULT 'REGISTRADA',
    "defenseDeadline" DATETIME,
    "communicantName" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Communication_typeId_fkey" FOREIGN KEY ("typeId") REFERENCES "CommunicationType" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Communication_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Communication_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Communication_platoonId_fkey" FOREIGN KEY ("platoonId") REFERENCES "Platoon" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Communication_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Communication_manualRuleId_fkey" FOREIGN KEY ("manualRuleId") REFERENCES "ManualRule" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Communication" ("article", "courseId", "courseNumber", "createdAt", "defenseDeadline", "factDate", "factDescription", "factPlace", "factTime", "finalScore", "id", "item", "letter", "manualRuleId", "platoonId", "protocolNumber", "reporterId", "status", "studentId", "suggestedScore", "typeId", "updatedAt") SELECT "article", "courseId", "courseNumber", "createdAt", "defenseDeadline", "factDate", "factDescription", "factPlace", "factTime", "finalScore", "id", "item", "letter", "manualRuleId", "platoonId", "protocolNumber", "reporterId", "status", "studentId", "suggestedScore", "typeId", "updatedAt" FROM "Communication";
DROP TABLE "Communication";
ALTER TABLE "new_Communication" RENAME TO "Communication";
CREATE UNIQUE INDEX "Communication_protocolNumber_key" ON "Communication"("protocolNumber");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
