-- DropIndex
DROP INDEX "Course_name_key";

-- AlterTable
ALTER TABLE "DisciplinaryBookItem" ADD COLUMN "originalArticle" TEXT;
ALTER TABLE "DisciplinaryBookItem" ADD COLUMN "originalItem" TEXT;
ALTER TABLE "DisciplinaryBookItem" ADD COLUMN "originalLetter" TEXT;

-- CreateTable
CREATE TABLE "Aacp" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "disciplinaryBookId" TEXT NOT NULL,
    "local" TEXT NOT NULL DEFAULT 'Academia de Polícia Militar do Espírito Santo - APM/ES',
    "fiscalizacao" TEXT NOT NULL DEFAULT 'Oficial de Dia',
    "versao" INTEGER NOT NULL DEFAULT 1,
    "saturdayDate" DATETIME NOT NULL,
    "sundayDate" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Aacp_disciplinaryBookId_fkey" FOREIGN KEY ("disciplinaryBookId") REFERENCES "DisciplinaryBook" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AacpDayGroup" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "aacpId" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "cpiLabel" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    CONSTRAINT "AacpDayGroup_aacpId_fkey" FOREIGN KEY ("aacpId") REFERENCES "Aacp" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AacpAction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "groupId" TEXT NOT NULL,
    "acao" TEXT NOT NULL,
    "periodo" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    CONSTRAINT "AacpAction_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "AacpDayGroup" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AacpMaterial" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "aacpId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    CONSTRAINT "AacpMaterial_aacpId_fkey" FOREIGN KEY ("aacpId") REFERENCES "Aacp" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AacpObservacao" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "aacpId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    CONSTRAINT "AacpObservacao_aacpId_fkey" FOREIGN KEY ("aacpId") REFERENCES "Aacp" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AacpDispositivoLegal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "aacpId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    CONSTRAINT "AacpDispositivoLegal_aacpId_fkey" FOREIGN KEY ("aacpId") REFERENCES "Aacp" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Attachment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "communicationId" TEXT NOT NULL,
    "defenseId" TEXT,
    "opinionId" TEXT,
    "decisionId" TEXT,
    "fileName" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "fileType" TEXT,
    "uploadedBy" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Attachment_communicationId_fkey" FOREIGN KEY ("communicationId") REFERENCES "Communication" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Attachment_defenseId_fkey" FOREIGN KEY ("defenseId") REFERENCES "Defense" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Attachment_opinionId_fkey" FOREIGN KEY ("opinionId") REFERENCES "Opinion" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Attachment_decisionId_fkey" FOREIGN KEY ("decisionId") REFERENCES "Decision" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Attachment" ("communicationId", "createdAt", "fileName", "filePath", "fileType", "id", "uploadedBy") SELECT "communicationId", "createdAt", "fileName", "filePath", "fileType", "id", "uploadedBy" FROM "Attachment";
DROP TABLE "Attachment";
ALTER TABLE "new_Attachment" RENAME TO "Attachment";
CREATE INDEX "Attachment_communicationId_idx" ON "Attachment"("communicationId");
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
    "halfCpi1" BOOLEAN NOT NULL DEFAULT false,
    "commanderObservation" TEXT,
    "status" TEXT NOT NULL DEFAULT 'REGISTRADA',
    "divisionForwardReason" TEXT,
    "divisionForwardedAt" DATETIME,
    "defenseDeadline" DATETIME,
    "communicantName" TEXT,
    "communicantUserId" TEXT,
    "adaptationPeriod" BOOLEAN NOT NULL DEFAULT false,
    "bgpmNumber" TEXT,
    "bgpmYear" TEXT,
    "tacEquivalent" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Communication_typeId_fkey" FOREIGN KEY ("typeId") REFERENCES "CommunicationType" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Communication_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Communication_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Communication_platoonId_fkey" FOREIGN KEY ("platoonId") REFERENCES "Platoon" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Communication_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Communication_communicantUserId_fkey" FOREIGN KEY ("communicantUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Communication_manualRuleId_fkey" FOREIGN KEY ("manualRuleId") REFERENCES "ManualRule" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Communication" ("article", "commanderObservation", "communicantName", "courseId", "courseNumber", "createdAt", "defenseDeadline", "divisionForwardReason", "divisionForwardedAt", "factDate", "factDescription", "factPlace", "factTime", "finalScore", "halfCpi1", "id", "item", "letter", "manualRuleId", "platoonId", "protocolNumber", "reporterId", "status", "studentId", "suggestedScore", "typeId", "updatedAt") SELECT "article", "commanderObservation", "communicantName", "courseId", "courseNumber", "createdAt", "defenseDeadline", "divisionForwardReason", "divisionForwardedAt", "factDate", "factDescription", "factPlace", "factTime", "finalScore", "halfCpi1", "id", "item", "letter", "manualRuleId", "platoonId", "protocolNumber", "reporterId", "status", "studentId", "suggestedScore", "typeId", "updatedAt" FROM "Communication";
DROP TABLE "Communication";
ALTER TABLE "new_Communication" RENAME TO "Communication";
CREATE UNIQUE INDEX "Communication_protocolNumber_key" ON "Communication"("protocolNumber");
CREATE INDEX "Communication_studentId_idx" ON "Communication"("studentId");
CREATE INDEX "Communication_courseId_idx" ON "Communication"("courseId");
CREATE INDEX "Communication_status_idx" ON "Communication"("status");
CREATE INDEX "Communication_reporterId_idx" ON "Communication"("reporterId");
CREATE INDEX "Communication_communicantUserId_idx" ON "Communication"("communicantUserId");
CREATE TABLE "new_Defense" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "communicationId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "submittedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isLate" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "Defense_communicationId_fkey" FOREIGN KEY ("communicationId") REFERENCES "Communication" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Defense_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Defense" ("communicationId", "id", "isLate", "studentId", "submittedAt", "text") SELECT "communicationId", "id", "isLate", "studentId", "submittedAt", "text" FROM "Defense";
DROP TABLE "Defense";
ALTER TABLE "new_Defense" RENAME TO "Defense";
CREATE INDEX "Defense_communicationId_idx" ON "Defense"("communicationId");
CREATE TABLE "new_DisciplinaryBook" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "number" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "courseId" TEXT,
    "school" TEXT,
    "publicationDate" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'RASCUNHO',
    "createdById" TEXT NOT NULL,
    "publishedById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DisciplinaryBook_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "DisciplinaryBook_publishedById_fkey" FOREIGN KEY ("publishedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "DisciplinaryBook_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_DisciplinaryBook" ("createdAt", "createdById", "id", "number", "publicationDate", "publishedById", "school", "status", "updatedAt") SELECT "createdAt", "createdById", "id", "number", "publicationDate", "publishedById", "school", "status", "updatedAt" FROM "DisciplinaryBook";
DROP TABLE "DisciplinaryBook";
ALTER TABLE "new_DisciplinaryBook" RENAME TO "DisciplinaryBook";
CREATE INDEX "DisciplinaryBook_status_idx" ON "DisciplinaryBook"("status");
CREATE UNIQUE INDEX "DisciplinaryBook_courseId_year_number_key" ON "DisciplinaryBook"("courseId", "year", "number");
CREATE TABLE "new_Student" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "fullName" TEXT NOT NULL,
    "warName" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "courseNumber" TEXT NOT NULL,
    "platoonId" TEXT,
    "cpf" TEXT,
    "userId" TEXT,
    "rg" TEXT NOT NULL,
    "functionalNumber" TEXT,
    "email" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ATIVO',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Student_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Student_platoonId_fkey" FOREIGN KEY ("platoonId") REFERENCES "Platoon" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Student_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Student" ("courseId", "courseNumber", "createdAt", "email", "fullName", "functionalNumber", "id", "platoonId", "rg", "status", "updatedAt", "warName") SELECT "courseId", "courseNumber", "createdAt", "email", "fullName", "functionalNumber", "id", "platoonId", "rg", "status", "updatedAt", "warName" FROM "Student";
DROP TABLE "Student";
ALTER TABLE "new_Student" RENAME TO "Student";
CREATE UNIQUE INDEX "Student_userId_key" ON "Student"("userId");
CREATE INDEX "Student_courseId_idx" ON "Student"("courseId");
CREATE INDEX "Student_platoonId_idx" ON "Student"("platoonId");
CREATE INDEX "Student_rg_idx" ON "Student"("rg");
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "fullName" TEXT NOT NULL,
    "warName" TEXT NOT NULL,
    "rank" TEXT NOT NULL,
    "rg" TEXT NOT NULL,
    "functionalNumber" TEXT NOT NULL,
    "email" TEXT,
    "passwordHash" TEXT NOT NULL,
    "cpf" TEXT,
    "escola" TEXT NOT NULL DEFAULT 'TODAS',
    "role" TEXT NOT NULL DEFAULT 'PROTOCOLO',
    "additionalRoles" TEXT NOT NULL DEFAULT '',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_User" ("active", "createdAt", "email", "fullName", "functionalNumber", "id", "passwordHash", "rank", "rg", "role", "updatedAt", "warName") SELECT "active", "createdAt", "email", "fullName", "functionalNumber", "id", "passwordHash", "rank", "rg", "role", "updatedAt", "warName" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_rg_key" ON "User"("rg");
CREATE UNIQUE INDEX "User_functionalNumber_key" ON "User"("functionalNumber");
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "User_cpf_key" ON "User"("cpf");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "Aacp_disciplinaryBookId_key" ON "Aacp"("disciplinaryBookId");

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_entity_entityId_idx" ON "AuditLog"("entity", "entityId");

-- CreateIndex
CREATE INDEX "Course_school_idx" ON "Course"("school");

-- CreateIndex
CREATE UNIQUE INDEX "Course_name_year_key" ON "Course"("name", "year");

-- CreateIndex
CREATE INDEX "Decision_communicationId_idx" ON "Decision"("communicationId");

-- CreateIndex
CREATE INDEX "DisciplinaryBookItem_studentId_idx" ON "DisciplinaryBookItem"("studentId");

-- CreateIndex
CREATE INDEX "DisciplinaryBookItem_communicationId_idx" ON "DisciplinaryBookItem"("communicationId");

-- CreateIndex
CREATE UNIQUE INDEX "DisciplinaryBookItem_disciplinaryBookId_communicationId_key" ON "DisciplinaryBookItem"("disciplinaryBookId", "communicationId");

-- CreateIndex
CREATE INDEX "Opinion_communicationId_idx" ON "Opinion"("communicationId");

-- CreateIndex
CREATE INDEX "Platoon_courseId_idx" ON "Platoon"("courseId");

-- CreateIndex
CREATE INDEX "StudentAcknowledgement_communicationId_idx" ON "StudentAcknowledgement"("communicationId");

-- CreateIndex
CREATE INDEX "StudentAcknowledgement_studentId_idx" ON "StudentAcknowledgement"("studentId");

-- CreateIndex
CREATE INDEX "Witness_communicationId_idx" ON "Witness"("communicationId");

