"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

// Caminhos estáticos conhecidos → rótulo legível
const LABELS: Record<string, string> = {
  "/comunicacoes":                     "Comunicações",
  "/comunicacoes/nova/cpi":            "Nova CPI",
  "/comunicacoes/nova/referencia":     "Nova Ref. Elogiosa",
  "/comunicacoes/nova/elogio-bi":      "Novo Elogio em BI",
  "/comunicacoes/nova/transgressao":   "Nova TD / TAC",
  "/comunicacoes/nova/lote":           "Lançamento em Lote",
  "/alunos":                           "Alunos",
  "/alunos/novo":                      "Novo Aluno",
  "/cursos":                           "Cursos",
  "/cursos/novo":                      "Novo Curso",
  "/usuarios":                         "Usuários",
  "/usuarios/novo":                    "Novo Usuário",
  "/ranking":                          "Ranking de Conduta",
  "/ranking/comunicantes":             "Comunicantes",
  "/ranking/comunicantes/imprimir":    "Imprimir",
  "/ranking/imprimir":                 "Imprimir",
  "/caderno":                          "Caderno Disciplinar",
  "/tipos":                            "Tipos de Comunicação",
  "/tipos/novo":                       "Novo Tipo",
  "/manual":                           "Manual do Aluno",
  "/manual/novo":                      "Novo Item",
  "/pelotons":                         "Pelotões",
  "/pelotons/novo":                    "Novo Pelotão",
  "/analise":                          "Análise",
  "/analise/imprimir":                 "Imprimir",
  "/relatorios":                       "Relatórios",
  "/relatorios/imprimir":              "Imprimir",
  "/despachos":                        "Despachos",
  "/auditoria":                        "Auditoria",
  "/perfil":                           "Meu Perfil",
  "/meus-registros":                   "Meus Registros",
  "/dashboard":                        "Painel",
};

// Segmentos dinâmicos conhecidos (último nível após um ID)
const DYNAMIC_LABELS: Record<string, string> = {
  "editar":        "Editar",
  "historico":     "Histórico",
  "imprimir":      "Imprimir",
  "decisao":       "Decisão",
  "parecer":       "Parecer",
  "termo-ciencia": "Termo de Ciência",
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function Breadcrumb() {
  const pathname = usePathname();

  const segments = pathname.split("/").filter(Boolean);
  const items: { label: string; href: string }[] = [];

  let path = "";
  for (const seg of segments) {
    path += "/" + seg;

    // Segmentos UUID: avançam o caminho mas não geram item no breadcrumb
    if (UUID_RE.test(seg)) continue;

    if (LABELS[path]) {
      items.push({ label: LABELS[path], href: path });
    } else if (DYNAMIC_LABELS[seg]) {
      items.push({ label: DYNAMIC_LABELS[seg], href: path });
    }
    // Segmentos organizacionais sem rótulo (ex: "nova") são silenciosamente ignorados
  }

  // Breadcrumb só faz sentido com 2+ itens; página raiz já tem seu próprio h1
  if (items.length < 2) return null;

  return (
    <nav className="px-6 pt-4 print:hidden" aria-label="Localização">
      <ol className="flex items-center flex-wrap gap-1 text-sm text-gray-500">
        {items.map((item, i) => {
          const isLast = i === items.length - 1;
          return (
            <li key={item.href} className="flex items-center gap-1">
              {i > 0 && <span className="text-gray-300 select-none">/</span>}
              {isLast ? (
                <span className="font-medium text-gray-700">{item.label}</span>
              ) : (
                <Link
                  href={item.href}
                  className="hover:text-[#1e3a5f] transition-colors"
                >
                  {item.label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
