"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

type NavItem = {
  href: string;
  label: string;
  icon: string;
  roles?: string[];
  hasBadge?: boolean;
  cfoOnly?: boolean;
};

const COMANDANTES = [
  "ADMINISTRADOR", "COMANDANTE_ESFAP", "COMANDANTE_ESFO", "CHEFE_DIVISAO_ACADEMICA",
  "SUBCOMANDANTE_ESFAP", "SUBCOMANDANTE_ESFO", "OFICIAL_ESFAP", "OFICIAL_ESFO",
];

const PARECERISTAS = [
  "SUBCOMANDANTE_ESFAP", "SUBCOMANDANTE_ESFO", "OFICIAL_ESFAP", "OFICIAL_ESFO",
];

const VIEWERS_APM = ["COMANDANTE_APM", "SUBCOMANDANTE_APM"];

const STAFF = [
  ...COMANDANTES, ...PARECERISTAS, ...VIEWERS_APM, "CHEFE_CURSO", "PROTOCOLO",
];

const RANKING_COMUNICANTES_ROLES = [...COMANDANTES, ...VIEWERS_APM];
const TIPOS_ROLES = [...COMANDANTES, ...PARECERISTAS];

const DESPACHOS_ROLES = [...COMANDANTES.filter((r) => r !== "ADMINISTRADOR"), ...PARECERISTAS, ...VIEWERS_APM];

const ROLE_LABELS: Record<string, string> = {
  ADMINISTRADOR:           "Administrador",
  COMANDANTE_APM:          "Cmte da APM/ES",
  SUBCOMANDANTE_APM:       "Sub-Cmte da APM/ES",
  CHEFE_DIVISAO_ACADEMICA: "Chefe Div. Acadêmica",
  COMANDANTE_ESFAP:        "Cmte da EsFAP",
  COMANDANTE_ESFO:         "Cmte da EsFO",
  SUBCOMANDANTE_ESFAP:     "Sub-Cmte EsFAP",
  SUBCOMANDANTE_ESFO:      "Sub-Cmte EsFO",
  OFICIAL_ESFAP:           "Oficial EsFAP",
  OFICIAL_ESFO:            "Oficial EsFO",
  CHEFE_CURSO:             "Chefe de Curso",
  PROTOCOLO:               "Setor de Protocolo",
  ALUNO:                   "Aluno",
};

const nav: NavItem[] = [
  { href: "/dashboard",    label: "Painel",               icon: "📊" },
  { href: "/comunicacoes",             label: "Comunicações",         icon: "📋", hasBadge: true },
  { href: "/comunicacoes/nova/cpi",       label: "Nova CPI",             icon: "📝", cfoOnly: true },
  { href: "/comunicacoes/nova/referencia", label: "Nova Ref. Elogiosa",  icon: "⭐", cfoOnly: true },
  { href: "/despachos",    label: "Despachos",            icon: "📨", roles: DESPACHOS_ROLES, hasBadge: true },
  { href: "/alunos",       label: "Alunos",               icon: "👤", roles: STAFF },
  { href: "/caderno",      label: "Caderno Disciplinar",  icon: "📖", roles: STAFF },
  { href: "/ranking",             label: "Ranking de Conduta",      icon: "🏆", roles: STAFF },
  { href: "/ranking/comunicantes", label: "Ranking de Comunicantes", icon: "📣", roles: RANKING_COMUNICANTES_ROLES },
  { href: "/relatorios",   label: "Relatórios",           icon: "📈", roles: STAFF },
  { href: "/analise",      label: "Análise",              icon: "📊", roles: STAFF },
  { href: "/usuarios",     label: "Usuários",             icon: "👥", roles: [...COMANDANTES, ...VIEWERS_APM] },
  { href: "/cursos",       label: "Cursos",               icon: "🎓", roles: COMANDANTES },
  { href: "/tipos",        label: "Tipos de Comunicação", icon: "⚙️", roles: TIPOS_ROLES },
  { href: "/auditoria",    label: "Auditoria",            icon: "🔍", roles: ["ADMINISTRADOR"] },
  { href: "/perfil",       label: "Meu Perfil",           icon: "👤" },
];

export default function Sidebar({
  role,
  rank,
  warName,
  badgeCounts = {},
  canCreateComm = false,
}: {
  role: string;
  rank: string;
  warName: string;
  badgeCounts?: Record<string, number>;
  canCreateComm?: boolean;
}) {
  const pathname = usePathname();
  const isUnrestricted = ["ADMINISTRADOR", "CHEFE_DIVISAO_ACADEMICA"].includes(role);
  const visibleNav = nav.filter((item) =>
    (isUnrestricted || !item.roles || item.roles.includes(role)) &&
    (!item.cfoOnly || canCreateComm)
  );

  return (
    <div className="flex flex-col w-64 bg-[#1e3a5f] min-h-screen">
      <div className="flex items-center justify-center h-16 border-b border-[#16304f] px-3">
        <div className="flex items-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brasao-apm.png" alt="APM/ES" style={{ height: 38, width: "auto", objectFit: "contain", flexShrink: 0 }} />
          <div>
            <h1 className="text-white font-bold text-lg leading-tight">SiGeCon</h1>
            <p className="text-blue-300 text-xs leading-tight">Sistema de Gestão de Conduta</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {visibleNav.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          const count = item.hasBadge ? (badgeCounts[item.href] ?? 0) : 0;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                active ? "bg-[#2a4d7a] text-white" : "text-blue-100 hover:bg-[#253f66] hover:text-white"
              }`}
            >
              <span className="flex items-center gap-3">
                <span className="text-base">{item.icon}</span>
                {item.label}
              </span>
              {count > 0 && (
                <span className="bg-red-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
                  {count > 99 ? "99+" : count}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-[#16304f] p-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 bg-[#2a4d7a] rounded-full flex items-center justify-center">
            <span className="text-white text-xs font-bold">{warName.charAt(0).toUpperCase()}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-sm font-medium truncate">
              {rank && <span className="text-blue-200 font-normal">{rank} </span>}
              {warName}
            </p>
            <p className="text-blue-300 text-xs truncate">{ROLE_LABELS[role] ?? role.replace(/_/g, " ")}</p>
          </div>
        </div>
        <form action="/logout" method="POST">
          <button type="submit" className="w-full text-left text-blue-300 hover:text-white text-xs py-1 transition-colors">
            Sair do sistema
          </button>
        </form>
      </div>
    </div>
  );
}
