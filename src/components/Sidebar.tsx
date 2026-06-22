"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

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
  { href: "/manual",       label: "Manual do Aluno",      icon: "📕", roles: ["ADMINISTRADOR", "CHEFE_DIVISAO_ACADEMICA", "COMANDANTE_ESFO", "SUBCOMANDANTE_ESFO", "OFICIAL_ESFO", "COMANDANTE_ESFAP", "SUBCOMANDANTE_ESFAP", "OFICIAL_ESFAP"] },
  { href: "/tipos",        label: "Tipos de Comunicação", icon: "⚙️", roles: TIPOS_ROLES },
  { href: "/auditoria",    label: "Auditoria",            icon: "🔍", roles: ["ADMINISTRADOR"] },
  { href: "/meus-registros", label: "Meus Registros",       icon: "✍️" },
  { href: "/perfil",         label: "Meu Perfil",           icon: "👤" },
];

export default function Sidebar({
  role,
  additionalRoles = "",
  rank,
  warName,
  badgeCounts = {},
  canCreateComm = false,
}: {
  role: string;
  additionalRoles?: string;
  rank: string;
  warName: string;
  badgeCounts?: Record<string, number>;
  canCreateComm?: boolean;
}) {
  const allRoles = [role, ...additionalRoles.split(",").map((r) => r.trim()).filter(Boolean)];
  const roleLabel = allRoles.map((r) => ROLE_LABELS[r] ?? r.replace(/_/g, " ")).join("/");
  const pathname = usePathname();
  const isUnrestricted = ["ADMINISTRADOR", "CHEFE_DIVISAO_ACADEMICA"].includes(role);
  const visibleNav = nav.filter((item) =>
    (isUnrestricted || !item.roles || item.roles.includes(role)) &&
    (!item.cfoOnly || canCreateComm)
  );

  // Estado da gaveta de menu no celular. No desktop (md+) a barra é fixa e este
  // estado não tem efeito visual. Fecha ao tocar num item (onClick nos links).
  const [aberto, setAberto] = useState(false);

  return (
    <>
      {/* Barra superior — só no celular (md:hidden). Abre a gaveta de menu. */}
      <div className="md:hidden fixed top-0 inset-x-0 h-14 z-30 bg-[#1e3a5f] flex items-center justify-between px-4 print:hidden">
        <div className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brasao-apm-sm.png" alt="APM/ES" style={{ height: 30, width: "auto", objectFit: "contain", flexShrink: 0 }} />
          <span className="text-white font-bold text-base">SiGeCon</span>
        </div>
        <button
          type="button"
          onClick={() => setAberto(true)}
          aria-label="Abrir menu"
          aria-expanded={aberto}
          aria-controls="menu-lateral"
          className="text-white text-2xl leading-none px-2 py-1 rounded hover:bg-[#253f66] focus:outline-none focus:ring-2 focus:ring-blue-300"
        >
          ☰
        </button>
      </div>

      {/* Fundo escurecido — só no celular, quando a gaveta está aberta. */}
      {aberto && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/50 print:hidden"
          onClick={() => setAberto(false)}
          aria-hidden="true"
        />
      )}

      {/* Painel de navegação. No celular é uma gaveta (fixed, desliza pela
          esquerda); no desktop (md+) volta a ser a barra fixa de sempre. */}
      <div
        id="menu-lateral"
        className={`flex flex-col w-64 bg-[#1e3a5f] min-h-screen h-full fixed inset-y-0 left-0 z-50 transition-transform duration-200 md:static md:z-auto md:translate-x-0 print:hidden ${aberto ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="relative flex items-center justify-center h-16 border-b border-[#16304f] px-3">
          <div className="flex items-center gap-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brasao-apm-sm.png" alt="APM/ES" style={{ height: 38, width: "auto", objectFit: "contain", flexShrink: 0 }} />
            <div>
              <h1 className="text-white font-bold text-lg leading-tight">SiGeCon</h1>
              <p className="text-blue-300 text-xs leading-tight">Sistema de Gestão de Conduta</p>
            </div>
          </div>
          {/* Fechar — só no celular. */}
          <button
            type="button"
            onClick={() => setAberto(false)}
            aria-label="Fechar menu"
            className="md:hidden absolute right-2 top-1/2 -translate-y-1/2 text-blue-200 text-2xl leading-none px-2 py-1 rounded hover:bg-[#253f66] focus:outline-none focus:ring-2 focus:ring-blue-300"
          >
            ✕
          </button>
        </div>

      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {visibleNav.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          const count = item.hasBadge ? (badgeCounts[item.href] ?? 0) : 0;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setAberto(false)}
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
            <p className="text-blue-300 text-xs truncate">{roleLabel}</p>
          </div>
        </div>
        <form action="/logout" method="POST">
          <button type="submit" className="w-full text-left text-blue-300 hover:text-white text-xs py-1 transition-colors">
            Sair do sistema
          </button>
        </form>
      </div>
      </div>
    </>
  );
}
