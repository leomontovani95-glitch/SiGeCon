// Validação das variáveis de ambiente obrigatórias. Chamada no boot
// (instrumentation.ts) para falhar de forma CLARA caso algo esteja ausente,
// em vez de quebrar de forma obscura em runtime (ex.: JWT assinado com segredo
// vazio, ou Prisma sem URL de banco).
const OBRIGATORIAS = ["SESSION_SECRET", "DATABASE_URL"] as const;

export function validarEnv(): void {
  const faltando = OBRIGATORIAS.filter((nome) => {
    const valor = process.env[nome];
    return !valor || valor.trim() === "";
  });
  if (faltando.length > 0) {
    throw new Error(
      `Variáveis de ambiente obrigatórias ausentes: ${faltando.join(", ")}. ` +
        "Configure-as no arquivo .env antes de iniciar o servidor.",
    );
  }
}
