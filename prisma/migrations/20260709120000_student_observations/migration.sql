-- CreateTable
CREATE TABLE "StudentObservation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "studentId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "authorRoleSnapshot" TEXT NOT NULL,
    "nature" TEXT NOT NULL DEFAULT 'NEUTRA',
    "text" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "editedAt" DATETIME,
    CONSTRAINT "StudentObservation_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "StudentObservation_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ObservationAttachment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "observationId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "fileType" TEXT,
    "uploadedBy" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ObservationAttachment_observationId_fkey" FOREIGN KEY ("observationId") REFERENCES "StudentObservation" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "StudentObservation_studentId_idx" ON "StudentObservation"("studentId");

-- CreateIndex
CREATE INDEX "StudentObservation_authorId_idx" ON "StudentObservation"("authorId");

-- CreateIndex
CREATE INDEX "ObservationAttachment_observationId_idx" ON "ObservationAttachment"("observationId");
