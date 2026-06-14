export async function register() {
  // Roda apenas no runtime Node.js (não no Edge runtime)
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  // Fixa o fuso em horário de Brasília (ES = UTC-3, sem horário de verão) para
  // o comportamento de datas/prazos ser determinístico onde quer que o app rode.
  // Em produção, idealmente também definir TZ=America/Sao_Paulo no ambiente.
  if (!process.env.TZ) process.env.TZ = "America/Sao_Paulo";

  const { processarPrazosExpirados } = await import("./lib/processar-prazos");

  // Executa imediatamente ao iniciar o servidor
  await processarPrazosExpirados().catch((e: unknown) =>
    console.error("[SiGeCon] Erro ao processar prazos na inicialização:", e)
  );

  // Executa a cada 30 minutos enquanto o servidor estiver rodando
  setInterval(async () => {
    await processarPrazosExpirados().catch((e: unknown) =>
      console.error("[SiGeCon] Erro ao processar prazos:", e)
    );
  }, 30 * 60 * 1000);
}
