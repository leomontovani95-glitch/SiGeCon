// Paleta única por tipo de comunicação, usada nos gráficos da Análise, na tela
// do Caderno Disciplinar e no PDF do caderno — fonte única para não divergirem.
//
// CPIs em escala amarelo → vermelho (gravidade crescente). Demais tipos mantêm
// suas cores (verde para favoráveis, cinza para arquivamento etc.).

export type CoresTipo = {
  bar: string;      // fundo da barra do cabeçalho da tabela
  barText: string;  // texto sobre a barra (contraste: escuro no amarelo, branco no resto)
  title: string;    // cor da fonte do título da seção (legível sobre fundo branco)
};

const BRANCO = "#ffffff";

const MAPA: Record<string, CoresTipo> = {
  // barText = fonte do cabeçalho sobre a barra: bem visível e nunca preta —
  // tom escuro da própria cor nos fundos claros; branco nos fundos escuros.
  "CPI 0": { bar: "#fef08a", barText: "#6b4e00", title: "#ca8a04" }, // amarelo claro
  "CPI 1": { bar: "#f1fc0f", barText: "#4d5800", title: "#8c8c00" }, // amarelo
  "CPI 2": { bar: "#f97316", barText: "#5c2208", title: "#ea580c" }, // laranja vivo
  "CPI 3": { bar: "#ef4444", barText: "#5c0a0a", title: "#dc2626" }, // vermelho vivo
  "Referência Elogiosa":    { bar: "#07e03a", barText: "#064d1a", title: "#08962a" },
  "Elogio publicado em BI": { bar: "#10ad17", barText: "#053d08", title: "#10ad17" },
  // TDs em escala de laranja (leveza crescente → mais escuro), TAC abaixo.
  "TD Leve":  { bar: "#fb923c", barText: "#7c2d12", title: "#ea580c" }, // laranja claro
  "TD Média": { bar: "#ea580c", barText: BRANCO,    title: "#c2410c" }, // laranja médio
  "TD Grave": { bar: "#c2410c", barText: BRANCO,    title: "#9a3412" }, // laranja escuro
  "TAC":      { bar: "#9a3412", barText: BRANCO,    title: "#7c2d12" }, // marrom-laranja
  "TD / TAC":               { bar: "#c2410c", barText: BRANCO,    title: "#c2410c" },
  "Reenquadramento":        { bar: "#ffedd5", barText: "#7c2d12", title: "#c2410c" },
  "Arquivamento":           { bar: "#6b7280", barText: BRANCO,    title: "#6b7280" },
};

export function coresTipo(chave: string): CoresTipo {
  return MAPA[chave] ?? { bar: "#1e3a5f", barText: BRANCO, title: "#1e3a5f" };
}

// Preto sobre fundos claros, branco sobre escuros — escolhe o que tem melhor
// contraste (luminância relativa, WCAG) para o texto sobre uma cor de fundo.
function luminancia(hex: string): number {
  const h = hex.replace("#", "");
  const canal = (i: number) => {
    const c = parseInt(h.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * canal(0) + 0.7152 * canal(2) + 0.0722 * canal(4);
}

export function corTextoLegivel(fundoHex: string): string {
  const L = luminancia(fundoHex);
  const contrastePreto  = (L + 0.05) / 0.05;
  const contrasteBranco = 1.05 / (L + 0.05);
  return contrastePreto >= contrasteBranco ? "#000000" : BRANCO;
}

// Preenchimento por grau de CPI (índice 0..3), para os gráficos da Análise.
export const CPI_FILL: string[] = [
  MAPA["CPI 0"].bar, MAPA["CPI 1"].bar, MAPA["CPI 2"].bar, MAPA["CPI 3"].bar,
];

// Cor de preenchimento (barra/fatia) para qualquer tipo de comunicação pelo nome.
// Fonte única usada nos gráficos de análise (tela e impressão).
export function corBarraTipo(nome: string): string {
  // CPI com grau numérico: "CPI 1", "CPI 2", "CPI 3" — extrai o grau.
  const cpi = nome.match(/cpi\s*(\d)/i);
  if (cpi) return MAPA[`CPI ${Math.min(3, parseInt(cpi[1], 10))}`]?.bar ?? MAPA["CPI 3"].bar;
  return coresTipo(nome).bar;
}
