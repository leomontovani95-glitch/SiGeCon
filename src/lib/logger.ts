// Logger estruturado mínimo (baseado em console). Usável no servidor e no cliente.
// Substitui os `catch {}` mudos: o fluxo segue (best-effort), mas a causa fica
// registrada e diagnosticável.
type Nivel = "error" | "warn" | "info" | "debug";

function emit(nivel: Nivel, contexto: string, erro?: unknown, extra?: Record<string, unknown>) {
  const payload = {
    ts: new Date().toISOString(),
    nivel,
    contexto,
    ...(erro !== undefined
      ? { erro: erro instanceof Error ? { message: erro.message, stack: erro.stack } : String(erro) }
      : {}),
    ...(extra ?? {}),
  };
  const linha = JSON.stringify(payload);
  if (nivel === "error") console.error(linha);
  else if (nivel === "warn") console.warn(linha);
  else console.log(linha);
}

export const logger = {
  error: (contexto: string, erro?: unknown, extra?: Record<string, unknown>) => emit("error", contexto, erro, extra),
  warn: (contexto: string, erro?: unknown, extra?: Record<string, unknown>) => emit("warn", contexto, erro, extra),
  info: (contexto: string, extra?: Record<string, unknown>) => emit("info", contexto, undefined, extra),
  debug: (contexto: string, extra?: Record<string, unknown>) => emit("debug", contexto, undefined, extra),
};
