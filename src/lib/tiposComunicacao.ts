// Tipos de comunicação "de sistema": nomes referenciados diretamente por código
// em vários fluxos (nova CPI filtra por "CPI 1/2/3"; TD/TAC busca por "TD Leve"
// etc.; o caderno agrupa por esses nomes). Excluir ou renomear um deles quebraria
// essas buscas silenciosamente — por isso a exclusão é bloqueada. Eles ainda
// podem ser editados (pontuação/natureza) e inativados normalmente.
export const TIPOS_SISTEMA = [
  "CPI 1", "CPI 2", "CPI 3",
  "Referência Elogiosa", "Elogio publicado em BI",
  "TD Leve", "TD Média", "TD Grave",
  "TAC", "Arquivamento",
] as const;

export function ehTipoSistema(name: string): boolean {
  return (TIPOS_SISTEMA as readonly string[]).includes(name);
}
