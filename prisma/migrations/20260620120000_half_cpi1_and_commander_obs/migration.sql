-- AlterTable: dispositivo do manual pode valer 50% da CPI 1 (configurável)
ALTER TABLE "ManualRule" ADD COLUMN "halfCpi1" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable: snapshot do 50% na comunicação + observação livre do Comandante
ALTER TABLE "Communication" ADD COLUMN "halfCpi1" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Communication" ADD COLUMN "commanderObservation" TEXT;

-- Backfill: Art. 146, Inc. I (a/b) já era enquadrado como CPI 1 valendo 50%.
-- Preserva o comportamento atual (pontuação e observação do caderno) para os
-- dispositivos e comunicações já existentes.
UPDATE "ManualRule" SET "halfCpi1" = true WHERE "article" = '146' AND "item" = 'I';
UPDATE "Communication" SET "halfCpi1" = true WHERE "article" = '146' AND "item" = 'I';
