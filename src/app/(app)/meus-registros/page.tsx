import { prisma } from "@/lib/db";
import { verifySession } from "@/lib/dal";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import Link from "next/link";

const STATUS_LABELS: Record<string, string> = {
  REGISTRADA:                "Registrada",
  AGUARDANDO_CIENCIA:        "Ag. Ciência/Defesa",
  AGUARDANDO_DEFESA:         "Ag. Ciência/Defesa",
  JUSTIFICATIVA_APRESENTADA: "Defesa Apresentada",
  PRAZO_EXPIRADO:            "Prazo Expirado",
  AGUARDANDO_PARECER:        "Ag. Parecer",
  PARECER_EMITIDO:           "Parecer Emitido",
  AGUARDANDO_DECISAO:        "Ag. Decisão",
  AGUARDANDO_DECISAO_DIVISAO:"Ag. Decisão (Div. Acadêmica)",
  DECIDIDA:                  "Decidida",
  ARQUIVADA:                 "Arquivada",
  PUBLICADA_CADERNO:         "Pub. Caderno",
  FINALIZADA:                "Finalizada",
};

const STATUS_COLORS: Record<string, string> = {
  REGISTRADA:          "bg-blue-100 text-blue-700",
  AGUARDANDO_CIENCIA:  "bg-yellow-100 text-yellow-700",
  AGUARDANDO_DEFESA:   "bg-yellow-100 text-yellow-700",
  PRAZO_EXPIRADO:      "bg-red-100 text-red-700",
  AGUARDANDO_PARECER:  "bg-purple-100 text-purple-700",
  AGUARDANDO_DECISAO:  "bg-indigo-100 text-indigo-700",
  AGUARDANDO_DECISAO_DIVISAO: "bg-sky-100 text-sky-700",
  DECIDIDA:            "bg-green-100 text-green-700",
  ARQUIVADA:           "bg-gray-100 text-gray-700",
  PUBLICADA_CADERNO:   "bg-teal-100 text-teal-700",
  FINALIZADA:          "bg-green-200 text-green-900",
};

type CommItem = {
  status: string;
  decisions: { decisionType: string }[];
  disciplinaryBookItems: { disciplinaryBook: { status: string } }[];
};

function derivedStatus(c: CommItem): { label: string; color: string } {
  const arquivada = c.decisions.some((d) => d.decisionType.toLowerCase().includes("arquiv"));
  const publicada = c.disciplinaryBookItems.some((i) => i.disciplinaryBook.status === "PUBLICADO");
  if (c.status === "PUBLICADA_CADERNO") {
    if (arquivada) return { label: "Arquivada/Publicada", color: "bg-gray-200 text-gray-700" };
    return { label: "Decidida/Publicada", color: "bg-teal-100 text-teal-700" };
  }
  if (c.status === "DECIDIDA") {
    if (arquivada && publicada)  return { label: "Arquivada/Publicada",     color: "bg-gray-200 text-gray-700" };
    if (arquivada && !publicada) return { label: "Arquivada/Não publicada", color: "bg-gray-100 text-gray-500" };
    if (publicada)               return { label: "Decidida/Publicada",      color: "bg-teal-100 text-teal-700" };
    return                              { label: "Decidida/Não publicada",  color: "bg-green-100 text-green-700" };
  }
  return {
    label: STATUS_LABELS[c.status] ?? c.status,
    color: STATUS_COLORS[c.status] ?? "bg-gray-100 text-gray-700",
  };
}

// CPI 0 é nome não-oficial da CPI 1 (Art. 146, I, a) — agrupados no mesmo card
function categorizarTipo(nome: string): "cpi1" | "cpi2" | "cpi3" | "elogio" | null {
  if (nome === "CPI 1") return "cpi1";
  if (nome === "CPI 2") return "cpi2";
  if (nome === "CPI 3") return "cpi3";
  if (nome === "Referência Elogiosa" || nome === "Elogio publicado em BI") return "elogio";
  return null;
}

const CARDS = [
  { key: "cpi1",  label: "CPI 1",          sub: null, cor: "bg-orange-50 border-orange-200 text-orange-700" },
  { key: "cpi2",  label: "CPI 2",          sub: null,            cor: "bg-red-50 border-red-200 text-red-700" },
  { key: "cpi3",  label: "CPI 3",          sub: null,            cor: "bg-red-100 border-red-300 text-red-800" },
  { key: "elogio",label: "Ref. Elogiosa",  sub: null,            cor: "bg-green-50 border-green-200 text-green-700" },
] as const;

const PAGE_SIZE = 30;

function getPageNumbers(current: number, total: number): (number | "...")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: (number | "...")[] = [1];
  if (current > 3) pages.push("...");
  for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) pages.push(i);
  if (current < total - 2) pages.push("...");
  pages.push(total);
  return pages;
}

export default async function MeusRegistrosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const session = await verifySession();
  const sp = await searchParams;
  const busca     = sp.busca     ?? "";
  const tipo      = sp.tipo      ?? "";
  const adaptacao = sp.adaptacao ?? "";
  const pageRaw = parseInt(sp.page ?? "1", 10);
  const page    = isNaN(pageRaw) || pageRaw < 1 ? 1 : pageRaw;

  const baseWhere = {
    communicantUserId: session.userId,
    ...(tipo  ? { type: { name: tipo } }  : {}),
    ...(adaptacao === "sim" ? { adaptationPeriod: true } : adaptacao === "nao" ? { adaptationPeriod: false } : {}),
    ...(busca ? {
      OR: [
        { protocolNumber: { contains: busca } },
        { student: { warName:  { contains: busca } } },
        { student: { fullName: { contains: busca } } },
      ],
    } : {}),
  };

  const includeComm = {
    type:    true,
    student: true,
    course:  true,
    decisions:             { select: { decisionType: true } },
    disciplinaryBookItems: { include: { disciplinaryBook: { select: { status: true } } } },
  } as const;

  const [comunicacoes, total, todosTipos, tiposDisponiveis] = await Promise.all([
    prisma.communication.findMany({
      where:   baseWhere,
      orderBy: [{ createdAt: "desc" }],
      include: includeComm,
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.communication.count({ where: baseWhere }),
    // Busca todos os registros (sem filtro) só para os cards de totais
    prisma.communication.findMany({
      where:  { communicantUserId: session.userId },
      select: { type: { select: { name: true } } },
    }),
    prisma.communicationType.findMany({
      where:   { active: true },
      select:  { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  // Contagem fixa por categoria
  const counts: Record<string, number> = { cpi1: 0, cpi2: 0, cpi3: 0, elogio: 0 };
  for (const c of todosTipos) {
    const cat = categorizarTipo(c.type.name);
    if (cat) counts[cat]++;
  }
  const totalGeral = todosTipos.length;

  const totalPages = Math.ceil(total / PAGE_SIZE);

  function buildUrl(overrides: Record<string, string>) {
    const p = new URLSearchParams();
    if (busca)     p.set("busca",     busca);
    if (tipo)      p.set("tipo",      tipo);
    if (adaptacao) p.set("adaptacao", adaptacao);
    for (const [k, v] of Object.entries(overrides)) {
      if (v) p.set(k, v); else p.delete(k);
    }
    const qs = p.toString();
    return `/meus-registros${qs ? `?${qs}` : ""}`;
  }

  const thBase = "text-left px-3 py-2.5 font-medium text-gray-600 text-xs whitespace-nowrap";

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Registros como Comunicante</h1>
        <p className="text-sm text-gray-500">Comunicações confeccionadas por você como comunicante</p>
      </div>

      {/* Cards de resumo — sempre visíveis */}
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="flex flex-col items-center justify-center rounded-xl border border-gray-200 bg-gray-50 px-5 py-3 min-w-[110px]">
          <span className="text-2xl font-bold text-gray-800">{totalGeral}</span>
          <span className="text-xs font-medium text-gray-500 mt-0.5">Total</span>
        </div>
        {CARDS.map(({ key, label, sub, cor }) => (
          <div
            key={key}
            className={`flex flex-col items-center justify-center rounded-xl border px-5 py-3 min-w-[110px] ${cor}`}
          >
            <span className="text-2xl font-bold">{counts[key]}</span>
            <span className="text-xs font-medium mt-0.5 text-center leading-tight">{label}</span>
            {sub && <span className="text-[10px] opacity-70 text-center leading-tight">{sub}</span>}
          </div>
        ))}
      </div>

      {/* Filtros */}
      <form method="GET" className="bg-white rounded-xl border border-gray-200 p-4 mb-5 flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Busca</label>
          <input
            name="busca"
            defaultValue={busca}
            placeholder="Protocolo, nome de guerra..."
            className="input text-sm w-52"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Tipo</label>
          <select name="tipo" defaultValue={tipo} className="input text-sm">
            <option value="">Todos os tipos</option>
            {tiposDisponiveis.map((t) => (
              <option key={t.id} value={t.name}>{t.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Período de Adaptação</label>
          <select name="adaptacao" defaultValue={adaptacao} className="input text-sm">
            <option value="">Todos</option>
            <option value="sim">Sim</option>
            <option value="nao">Não</option>
          </select>
        </div>
        <div className="flex gap-2">
          <button type="submit" className="btn-primary">Filtrar</button>
          {(busca || tipo || adaptacao) && (
            <Link href="/meus-registros" className="btn-secondary text-sm">Limpar</Link>
          )}
        </div>
      </form>

      {/* Tabela */}
      {comunicacoes.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 px-6 py-10 text-center text-gray-400">
          {totalGeral === 0
            ? "Você ainda não confeccionou nenhuma comunicação como comunicante."
            : "Nenhuma comunicação encontrada com os filtros aplicados."}
        </div>
      ) : (
        <>
          <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto mb-4">
            <table className="w-full text-sm min-w-max">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className={thBase}>Protocolo</th>
                  <th className={thBase}>Tipo</th>
                  <th className={thBase}>Nº</th>
                  <th className={thBase}>Aluno comunicado</th>
                  <th className={thBase}>Curso</th>
                  <th className={thBase}>Data do Fato</th>
                  <th className={thBase}>Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {comunicacoes.map((c) => {
                  const ds = derivedStatus(c);
                  return (
                    <tr key={c.id} className="hover:bg-gray-50">
                      <td className="px-3 py-2.5 font-mono text-xs whitespace-nowrap">
                        <Link
                          href={`/comunicacoes/${c.id}`}
                          className="text-[#1e3a5f] hover:underline font-semibold"
                        >
                          {c.protocolNumber}
                        </Link>
                      </td>
                      <td className="px-3 py-2.5 text-xs text-gray-600 whitespace-nowrap">{c.type.name}</td>
                      <td className="px-3 py-2.5 font-mono text-xs text-gray-500 whitespace-nowrap text-center">{c.courseNumber}</td>
                      <td className="px-3 py-2.5 font-medium text-gray-900 text-xs whitespace-nowrap">
                        {session.role === "ALUNO" ? (
                          c.student.warName
                        ) : (
                          <Link href={`/alunos/${c.student.id}`} className="hover:text-[#1e3a5f] hover:underline">
                            {c.student.warName}
                          </Link>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-xs text-gray-500 whitespace-nowrap">{c.course.name}</td>
                      <td className="px-3 py-2.5 text-xs text-gray-500 whitespace-nowrap">
                        {format(new Date(c.factDate), "dd/MM/yyyy", { locale: ptBR })}
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ds.color}`}>{ds.label}</span>
                          {c.adaptationPeriod && (
                            <span className="text-xs px-1.5 py-0.5 rounded font-semibold bg-orange-100 text-orange-700">PA</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mb-6">
              <p className="text-sm text-gray-500">
                Mostrando {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} de {total} registro(s)
              </p>
              <div className="flex items-center gap-1">
                <Link
                  href={page > 1 ? buildUrl({ page: String(page - 1) }) : "#"}
                  className={`px-3 py-1.5 rounded text-sm border ${page <= 1 ? "border-gray-100 text-gray-300 pointer-events-none" : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"}`}
                  aria-disabled={page <= 1}
                >
                  ← Anterior
                </Link>
                {getPageNumbers(page, totalPages).map((p, i) =>
                  p === "..." ? (
                    <span key={`el-${i}`} className="px-2 text-sm text-gray-400">…</span>
                  ) : (
                    <Link
                      key={p}
                      href={buildUrl({ page: String(p) })}
                      className={`w-9 h-9 flex items-center justify-center rounded text-sm border ${p === page ? "bg-[#1e3a5f] text-white border-[#1e3a5f] font-semibold" : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"}`}
                    >
                      {p}
                    </Link>
                  )
                )}
                <Link
                  href={page < totalPages ? buildUrl({ page: String(page + 1) }) : "#"}
                  className={`px-3 py-1.5 rounded text-sm border ${page >= totalPages ? "border-gray-100 text-gray-300 pointer-events-none" : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"}`}
                  aria-disabled={page >= totalPages}
                >
                  Próxima →
                </Link>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
