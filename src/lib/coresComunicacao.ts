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
  "CPI 0": { bar: "#fef08a", barText: "#854d0e", title: "#ca8a04" }, // amarelo claro
  "CPI 1": { bar: "#f1fc0f", barText: "#422006", title: "#6e7400" }, // amarelo (título em tom escuro p/ legibilidade sobre branco)
  "CPI 2": { bar: "#f97316", barText: BRANCO,    title: "#ea580c" }, // laranja vivo
  "CPI 3": { bar: "#ef4444", barText: BRANCO,    title: "#dc2626" }, // vermelho vivo
  "Referência Elogiosa":    { bar: "#15803d", barText: BRANCO, title: "#15803d" },
  "Elogio publicado em BI": { bar: "#166534", barText: BRANCO, title: "#166534" },
  "TD / TAC":               { bar: "#c2410c", barText: BRANCO, title: "#c2410c" },
  // Reenquadramento: mesmas cores da tela (laranja claro no cabeçalho, título laranja-700)
  "Reenquadramento":        { bar: "#ffedd5", barText: "#7c2d12", title: "#c2410c" },
  "Arquivamento":           { bar: "#6b7280", barText: BRANCO, title: "#6b7280" },
};

export function coresTipo(chave: string): CoresTipo {
  return MAPA[chave] ?? { bar: "#1e3a5f", barText: BRANCO, title: "#1e3a5f" };
}

// Preenchimento por grau de CPI (índice 0..3), para os gráficos da Análise.
export const CPI_FILL: string[] = [
  MAPA["CPI 0"].bar, MAPA["CPI 1"].bar, MAPA["CPI 2"].bar, MAPA["CPI 3"].bar,
];
