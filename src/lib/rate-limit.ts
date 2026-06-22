"server-only";

// Limitador de tentativas em memória — proteção contra força bruta no login.
// Suficiente para um único processo Node (cenário da implantação atual). Se o app
// um dia escalar para múltiplos processos/instâncias, trocar por um store
// compartilhado (tabela no banco ou Redis), pois o Map não é compartilhado entre
// processos.
type Registro = { falhas: number[]; bloqueadoAte: number };

const registros = new Map<string, Registro>();

const JANELA_MS = 15 * 60 * 1000; // janela de contagem das falhas
const MAX_FALHAS = 5; // falhas permitidas dentro da janela
const BLOQUEIO_MS = 15 * 60 * 1000; // duração do bloqueio ao estourar o limite

export type ResultadoLimite = { permitido: true } | { permitido: false; esperarMs: number };

function descartarAntigas(reg: Registro, agora: number) {
  reg.falhas = reg.falhas.filter((t) => agora - t < JANELA_MS);
}

// Verifica se a chave está bloqueada. Não registra nada — só consulta.
export function verificarLimite(chave: string): ResultadoLimite {
  const agora = Date.now();
  const reg = registros.get(chave);
  if (!reg) return { permitido: true };
  if (reg.bloqueadoAte > agora) return { permitido: false, esperarMs: reg.bloqueadoAte - agora };
  return { permitido: true };
}

// Contabiliza uma falha; ao atingir MAX_FALHAS na janela, bloqueia por BLOQUEIO_MS.
export function registrarFalha(chave: string): void {
  const agora = Date.now();
  const reg = registros.get(chave) ?? { falhas: [], bloqueadoAte: 0 };
  descartarAntigas(reg, agora);
  reg.falhas.push(agora);
  if (reg.falhas.length >= MAX_FALHAS) {
    reg.bloqueadoAte = agora + BLOQUEIO_MS;
    reg.falhas = [];
  }
  registros.set(chave, reg);
}

// Zera o histórico da chave (chamar após login bem-sucedido).
export function limparTentativas(chave: string): void {
  registros.delete(chave);
}
