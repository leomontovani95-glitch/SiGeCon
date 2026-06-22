export async function register() {
  // Roda apenas no runtime Node.js (não no Edge runtime)
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  // Falha cedo e claro se faltar variável obrigatória (SESSION_SECRET/DATABASE_URL).
  const { validarEnv } = await import("./lib/env");
  validarEnv();

  // Fixa o fuso em horário de Brasília (ES = UTC-3, sem horário de verão) para
  // o comportamento de datas/prazos ser determinístico onde quer que o app rode.
  // Em produção, idealmente também definir TZ=America/Sao_Paulo no ambiente.
  if (!process.env.TZ) process.env.TZ = "America/Sao_Paulo";

  const { processarPrazosExpirados } = await import("./lib/processar-prazos");
  const { logger } = await import("./lib/logger");

  // SQLite para uso concorrente: WAL (persistente) + busy_timeout (best-effort).
  const { aplicarPragmasSQLite } = await import("./lib/db");
  try {
    await aplicarPragmasSQLite();
    logger.info("SQLite: PRAGMAs aplicados (journal_mode=WAL, busy_timeout=5000)");
  } catch (e) {
    logger.warn("SQLite: falha ao aplicar PRAGMAs (WAL/busy_timeout)", e);
  }

  // Guarda de re-entrância: evita execuções sobrepostas no mesmo processo
  // (ex.: a do boot com a primeira do intervalo, ou um ciclo que demore).
  let rodando = false;
  const rodar = async () => {
    if (rodando) return;
    rodando = true;
    try {
      await processarPrazosExpirados();
    } catch (e) {
      logger.error("processarPrazosExpirados (scheduler)", e);
    } finally {
      rodando = false;
    }
  };

  await rodar(); // ao iniciar o servidor
  setInterval(rodar, 30 * 60 * 1000); // a cada 30 minutos
}
