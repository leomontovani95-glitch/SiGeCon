-- AlterTable: encaminhamento de CPI à decisão do Chefe da Divisão Acadêmica
-- (motivo obrigatório + data); usado com o status AGUARDANDO_DECISAO_DIVISAO.
ALTER TABLE "Communication" ADD COLUMN "divisionForwardReason" TEXT;
ALTER TABLE "Communication" ADD COLUMN "divisionForwardedAt" DATETIME;
