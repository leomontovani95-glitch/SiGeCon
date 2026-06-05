-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "fullName" TEXT NOT NULL,
    "warName" TEXT NOT NULL,
    "rank" TEXT NOT NULL,
    "rg" TEXT NOT NULL,
    "functionalNumber" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'COMUNICANTE',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Course" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "acronym" TEXT NOT NULL,
    "year" INTEGER,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Platoon" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Platoon_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Student" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "fullName" TEXT NOT NULL,
    "warName" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "courseNumber" TEXT NOT NULL,
    "platoonId" TEXT,
    "rg" TEXT NOT NULL,
    "functionalNumber" TEXT,
    "email" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ATIVO',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Student_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Student_platoonId_fkey" FOREIGN KEY ("platoonId") REFERENCES "Platoon" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ManualRule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "article" TEXT NOT NULL,
    "item" TEXT,
    "letter" TEXT,
    "description" TEXT NOT NULL,
    "defaultCommunicationType" TEXT,
    "defaultScore" REAL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "CommunicationType" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "score" REAL NOT NULL,
    "scoreNature" TEXT NOT NULL DEFAULT 'DESFAVORAVEL',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Communication" (
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
    "internalNotes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Communication_typeId_fkey" FOREIGN KEY ("typeId") REFERENCES "CommunicationType" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Communication_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Communication_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Communication_platoonId_fkey" FOREIGN KEY ("platoonId") REFERENCES "Platoon" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Communication_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Communication_manualRuleId_fkey" FOREIGN KEY ("manualRuleId") REFERENCES "ManualRule" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Witness" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "communicationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "rg" TEXT,
    "functionalNumber" TEXT,
    "contact" TEXT,
    "notes" TEXT,
    CONSTRAINT "Witness_communicationId_fkey" FOREIGN KEY ("communicationId") REFERENCES "Communication" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Attachment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "communicationId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "fileType" TEXT,
    "uploadedBy" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Attachment_communicationId_fkey" FOREIGN KEY ("communicationId") REFERENCES "Communication" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StudentAcknowledgement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "communicationId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "acknowledgedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "method" TEXT,
    "notes" TEXT,
    CONSTRAINT "StudentAcknowledgement_communicationId_fkey" FOREIGN KEY ("communicationId") REFERENCES "Communication" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "StudentAcknowledgement_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Defense" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "communicationId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "submittedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isLate" BOOLEAN NOT NULL DEFAULT false,
    "attachmentId" TEXT,
    CONSTRAINT "Defense_communicationId_fkey" FOREIGN KEY ("communicationId") REFERENCES "Communication" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Defense_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Defense_attachmentId_fkey" FOREIGN KEY ("attachmentId") REFERENCES "Attachment" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Opinion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "communicationId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "authorRole" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "recommendation" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Opinion_communicationId_fkey" FOREIGN KEY ("communicationId") REFERENCES "Communication" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Opinion_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Decision" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "communicationId" TEXT NOT NULL,
    "authorityId" TEXT NOT NULL,
    "decisionType" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "finalScore" REAL,
    "decidedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Decision_communicationId_fkey" FOREIGN KEY ("communicationId") REFERENCES "Communication" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Decision_authorityId_fkey" FOREIGN KEY ("authorityId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DisciplinaryBook" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "number" INTEGER NOT NULL,
    "publicationDate" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'RASCUNHO',
    "createdById" TEXT NOT NULL,
    "publishedById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DisciplinaryBook_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "DisciplinaryBook_publishedById_fkey" FOREIGN KEY ("publishedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DisciplinaryBookItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "disciplinaryBookId" TEXT NOT NULL,
    "communicationId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "courseId" TEXT,
    "platoonId" TEXT,
    "studentCourseNumber" TEXT NOT NULL,
    "studentWarName" TEXT NOT NULL,
    "recordType" TEXT NOT NULL,
    "factDate" DATETIME NOT NULL,
    "decisionSummary" TEXT NOT NULL,
    "score" REAL,
    "shortObservation" TEXT,
    CONSTRAINT "DisciplinaryBookItem_disciplinaryBookId_fkey" FOREIGN KEY ("disciplinaryBookId") REFERENCES "DisciplinaryBook" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "DisciplinaryBookItem_communicationId_fkey" FOREIGN KEY ("communicationId") REFERENCES "Communication" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "DisciplinaryBookItem_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "details" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_rg_key" ON "User"("rg");

-- CreateIndex
CREATE UNIQUE INDEX "User_functionalNumber_key" ON "User"("functionalNumber");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Course_name_key" ON "Course"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Student_rg_key" ON "Student"("rg");

-- CreateIndex
CREATE UNIQUE INDEX "CommunicationType_name_key" ON "CommunicationType"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Communication_protocolNumber_key" ON "Communication"("protocolNumber");

-- CreateIndex
CREATE UNIQUE INDEX "DisciplinaryBook_number_key" ON "DisciplinaryBook"("number");
