import { prisma } from "@/lib/db";
import { verifySession, getSchoolFilter, ESFO_CFO_RANK } from "@/lib/dal";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import Link from "next/link";

// ── Status base (DB) ─────────────────────────────────────────────────────────
const STATUS_LABELS_BASE: Record<string, string> = {
  REGISTRADA:                  "Registrada",
  AGUARDANDO_CIENCIA:          "Ag. Ciência/Defesa",
  AGUARDANDO_DEFESA:           "Ag. Ciência/Defesa",
  JUSTIFICATIVA_APRESENTADA:   "Defesa Apresentada",
  PRAZO_EXPIRADO:              "Prazo Expirado",
  AGUARDANDO_PARECER:          "Ag. Parecer",
  PARECER_EMITIDO:             "Parecer Emitido",
  AGUARDANDO_DECISAO:          "Ag. Decisão",
  DECIDIDA:                    "Decidida",
  ARQUIVADA:                   "Arquivada",
  PUBLICADA_CADERNO:           "Pub. Caderno",
  FINALIZADA:                  "Finalizada",
};

const STATUS_COLORS_BASE: Record<string, string> = {
  REGISTRADA:          "bg-blue-100 text-blue-700",
  AGUARDANDO_CIENCIA:  "bg-yellow-100 text-yellow-700",
  AGUARDANDO_DEFESA:   "bg-yellow-100 text-yellow-700",
  PRAZO_EXPIRADO:      "bg-red-100 text-red-700",
  AGUARDANDO_PARECER:  "bg-purple-100 text-purple-700",
  AGUARDANDO_DECISAO:  "bg-indigo-100 text-indigo-700",
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

function derivedStatus(c: CommItem): { key: string; label: string; color: string } {
  // PUBLICADA_CADERNO é status legado — semanticamente equivale a Decidida/Publicada
  if (c.status === "PUBLICADA_CADERNO") {
    return { key: "DECIDIDA_PUBLICADA", label: "Decidida/Publicada", color: "bg-teal-100 text-teal-700" };
  }
  if (c.status === "DECIDIDA") {
    const arquivada = c.decisions.some((d) => d.decisionType.toLowerCase().includes("arquiv"));
    if (arquivada) return { key: "ARQUIVADA_DEC", label: "Arquivada", color: "bg-gray-100 text-gray-700" };
    const publicada = c.disciplinaryBookItems.some((i) => i.disciplinaryBook.status === "PUBLICADO");
    if (publicada) return { key: "DECIDIDA_PUBLICADA", label: "Decidida/Publicada", color: "bg-teal-100 text-teal-700" };
    return { key: "DECIDIDA_NAO_PUBLICADA", label: "Decidida/Não publicada", color: "bg-green-100 text-green-700" };
  }
  return {
    key: c.status,
    label: STATUS_LABELS_BASE[c.status] ?? c.status,
    color: STATUS_COLORS_BASE[c.status] ?? "bg-gray-100 text-gray-700",
  };
}

const FILTER_OPTIONS = [
  { value: "",                       label: "Todos os status" },
  { value: "AGUARDANDO_CIENCIA",     label: "Ag. Ciência/Defesa" },
  { value: "PRAZO_EXPIRADO",         label: "Prazo Expirado" },
  { value: "JUSTIFICATIVA_APRESENTADA", label: "Defesa Apresentada" },
  { value: "AGUARDANDO_PARECER",     label: "Ag. Parecer" },
  { value: "AGUARDANDO_DECISAO",     label: "Ag. Decisão" },
  { value: "DECIDIDA_PUBLICADA",     label: "Decidida/Publicada" },
  { value: "DECIDIDA_NAO_PUBLICADA", label: "Decidida/Não publicada" },
  { value: "ARQUIVADA_DEC",          label: "Arquivada" },
];

function buildStatusWhere(status: string): Record<string, unknown> | null {
  if (!status) return null;
  switch (status) {
    case "DECIDIDA_PUBLICADA":
      // Inclui tanto DECIDIDA (com item publicado) quanto o status legado PUBLICADA_CADERNO
      return {
        OR: [
          { status: "PUBLICADA_CADERNO" },
          { status: "DECIDIDA", disciplinaryBookItems: { some: { disciplinaryBook: { status: "PUBLICADO" } } } },
        ],
      };
    case "DECIDIDA_NAO_PUBLICADA":
      return {
        status: "DECIDIDA",
        disciplinaryBookItems: { none: { disciplinaryBook: { status: "PUBLICADO" } } },
        decisions: { none: { decisionType: { contains: "rquiv" } } },
      };
    case "ARQUIVADA_DEC":
      return { status: "DECIDIDA", decisions: { some: { decisionType: { contains: "rquiv" } } } };
    default:
      return { status };
  }
}

// Colunas ordenáveis e seus orderBy do Prisma
type Dir = "asc" | "desc";
const COLS: Record<string, (d: Dir) => object> = {
  protocolNumber: (d) => ({ protocolNumber: d }),
  typeName:       (d) => ({ type: { name: d } }),
  courseNumber:   (d) => ({ courseNumber: d }),
  warName:        (d) => ({ student: { warName: d } }),
  factDate:       (d) => ({ factDate: d }),
  status:         (d) => ({ status: d }),
};

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

export default async function ComunicacoesPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const session = await verifySession();
  const sp = await searchParams;
  const busca   = sp.busca   ?? "";
  const status  = sp.status  ?? "";
  const cursoId = sp.cursoId ?? "";
  const tipo    = sp.tipo    ?? "";
  const col     = sp.col in COLS ? sp.col : "";
  const dir: Dir = sp.dir === "asc" ? "asc" : "desc";
  const pageRaw  = parseInt(sp.page ?? "1", 10);
  const page     = isNaN(pageRaw) || pageRaw < 1 ? 1 : pageRaw;

  const school = getSchoolFilter(session.role, session.escola);

  const [cursosDisponiveis, tipos] = await Promise.all([
    session.role !== "ALUNO"
      ? prisma.course.findMany({
          where: { active: true, ...(school ? { school } : {}) },
          orderBy: { name: "asc" },
          select: { id: true, name: true },
        })
      : Promise.resolve([]),
    prisma.communicationType.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  const where: Record<string, unknown> = {};
  const statusWhere = buildStatusWhere(status);
  if (statusWhere) Object.assign(where, statusWhere);
  if (tipo)   where.type = { name: tipo };
  if (busca) {
    where.OR = [
      { protocolNumber: { contains: busca } },
      { student: { warName: { contains: busca } } },
      { student: { fullName: { contains: busca } } },
    ];
  }
  if (cursoId)      where.courseId = cursoId;
  else if (school)  where.course   = { school };
  let isEsfoCFO = false;
  if (session.role === "ALUNO") {
    const aluno = await prisma.student.findFirst({
      where: { userId: session.userId },
      include: { course: true },
    });
    if (aluno) {
      where.studentId = aluno.id;
      isEsfoCFO = aluno.course.name in ESFO_CFO_RANK;
    }
  }

  // orderBy: coluna escolhida → courseId → createdAt
  const orderBy = col
    ? [COLS[col](dir), { courseId: "asc" as const }, { createdAt: "desc" as const }]
    : [{ courseId: "asc" as const }, { createdAt: "desc" as const }];

  const includeComm = {
    type: true, student: true, reporter: true, course: true,
    decisions: { select: { decisionType: true } },
    disciplinaryBookItems: { include: { disciplinaryBook: { select: { status: true } } } },
  } as const;

  const [comunicacoes, totalComms, comunicacoesRegistradas] = await Promise.all([
    prisma.communication.findMany({ where, orderBy, include: includeComm, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE }),
    prisma.communication.count({ where }),
    isEsfoCFO
      ? prisma.communication.findMany({
          where: { communicantUserId: session.userId },
          orderBy: [{ courseId: "asc" as const }, { createdAt: "desc" as const }],
          include: includeComm,
          take: 100,
        })
      : Promise.resolve([] as Awaited<ReturnType<typeof prisma.communication.findMany<{ include: typeof includeComm }>>>),
  ]);

  // Agrupa por curso
  const cursosOrdem: string[] = [];
  const porCurso = new Map<string, { nome: string; itens: typeof comunicacoes }>();
  for (const c of comunicacoes) {
    const cid = c.courseId;
    if (!porCurso.has(cid)) { cursosOrdem.push(cid); porCurso.set(cid, { nome: c.course.name, itens: [] }); }
    porCurso.get(cid)!.itens.push(c);
  }

  const totalPages = Math.ceil(totalComms / PAGE_SIZE);

  const canCreate = session.role !== "ALUNO";
  const cursoSelecionado = cursosDisponiveis.find((c) => c.id === cursoId);
  const labelEscopo = school === "ESFAP" ? "Todos da EsFAP" : school === "ESFO" ? "Todos da EsFO" : "Todos os cursos";

  // Constrói URL preservando todos os filtros
  function buildUrl(overrides: Record<string, string>) {
    const p = new URLSearchParams();
    if (cursoId)  p.set("cursoId",  cursoId);
    if (busca)    p.set("busca",    busca);
    if (status)   p.set("status",   status);
    if (tipo)     p.set("tipo",     tipo);
    if (col)      p.set("col",      col);
    if (dir)      p.set("dir",      dir);
    for (const [k, v] of Object.entries(overrides)) {
      if (v) p.set(k, v); else p.delete(k);
    }
    const qs = p.toString();
    return `/comunicacoes${qs ? `?${qs}` : ""}`;
  }

  function pillHref(novoCursoId: string) {
    return buildUrl({ cursoId: novoCursoId, col: "", dir: "" });
  }

  // Gera href para ordenação de coluna (toggle asc/desc)
  function sortHref(newCol: string) {
    const newDir = col === newCol && dir === "asc" ? "desc" : "asc";
    return buildUrl({ col: newCol, dir: newDir });
  }

  // Indicador visual de ordenação
  function sortIndicator(c: string) {
    if (col !== c) return <span className="text-gray-300 group-hover:text-gray-500 ml-0.5">↕</span>;
    return <span className="text-[#1e3a5f] ml-0.5">{dir === "asc" ? "↑" : "↓"}</span>;
  }

  const thBase = "text-left px-3 py-2.5 font-medium text-gray-600 text-xs whitespace-nowrap";
  const thLink = "flex items-center gap-0.5 hover:text-[#1e3a5f] transition-colors cursor-pointer group select-none";

  return (
    <div className="p-6">
      {/* Título */}
      <div className="flex items-start justify-between mb-5 flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Comunicações</h1>
          <p className="text-sm text-gray-500">
            {cursoSelecionado ? cursoSelecionado.name : labelEscopo}
            {" · "}{totalComms} resultado(s)
          </p>
        </div>
        {canCreate && (
          <div className="flex gap-2 flex-wrap">
            <Link href="/comunicacoes/nova/cpi" className="bg-[#1e3a5f] text-white px-4 py-2 rounded-lg text-sm hover:bg-[#16304f] transition-colors">+ Nova CPI</Link>
            <Link href="/comunicacoes/nova/referencia" className="border border-[#1e3a5f] text-[#1e3a5f] px-4 py-2 rounded-lg text-sm hover:bg-blue-50 transition-colors">+ Ref. Elogiosa</Link>
            <Link href="/comunicacoes/nova/elogio-bi" className="border border-green-600 text-green-700 px-4 py-2 rounded-lg text-sm hover:bg-green-50 transition-colors">+ Elogio em BI</Link>
            <Link href="/comunicacoes/nova/transgressao" className="border border-orange-600 text-orange-700 px-4 py-2 rounded-lg text-sm hover:bg-orange-50 transition-colors">+ Nova TD / TAC</Link>
          </div>
        )}
      </div>

      {/* Seletor de cursos */}
      {cursosDisponiveis.length > 1 && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-5">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Filtrar por curso</p>
          <div className="flex flex-wrap gap-2">
            <Link href={pillHref("")} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${!cursoId ? "bg-[#1e3a5f] text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}>
              {labelEscopo}
            </Link>
            {cursosDisponiveis.map((curso) => (
              <Link key={curso.id} href={pillHref(curso.id)} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${cursoId === curso.id ? "bg-[#1e3a5f] text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}>
                {curso.name}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Filtros de busca, tipo e status */}
      <form method="GET" className="bg-white rounded-xl border border-gray-200 p-4 mb-5 flex flex-wrap gap-3 items-end">
        {cursoId && <input type="hidden" name="cursoId" value={cursoId} />}
        {col     && <input type="hidden" name="col"     value={col} />}
        {dir     && <input type="hidden" name="dir"     value={dir} />}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Busca</label>
          <input name="busca" defaultValue={busca} placeholder="Protocolo, nome de guerra..." className="input text-sm w-52" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Tipo</label>
          <select name="tipo" defaultValue={tipo} className="input text-sm">
            <option value="">Todos os tipos</option>
            {tipos.map((t) => (
              <option key={t.id} value={t.name}>{t.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
          <select name="status" defaultValue={status} className="input text-sm">
            {FILTER_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <div className="flex gap-2">
          <button type="submit" className="btn-primary">Filtrar</button>
          {(busca || tipo || status) && (
            <Link href={buildUrl({ busca: "", tipo: "", status: "" })} className="btn-secondary text-sm">Limpar</Link>
          )}
        </div>
      </form>

      {comunicacoes.length === 0 && (
        <div className="bg-white rounded-xl border border-gray-200 px-6 py-10 text-center text-gray-400">
          Nenhuma comunicação encontrada.
        </div>
      )}

      {cursosOrdem.map((cid) => {
        const grupo = porCurso.get(cid)!;
        return (
          <div key={cid} className="mb-8">
            {cursosOrdem.length > 1 && (
              <div className="flex items-center gap-3 mb-2">
                <h2 className="text-base font-bold text-[#1e3a5f] uppercase tracking-wide">{grupo.nome}</h2>
                <span className="text-xs text-gray-400 font-normal">{grupo.itens.length} registro(s)</span>
              </div>
            )}

            <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
              <table className="w-full text-sm min-w-max">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className={thBase}>
                      <Link href={sortHref("protocolNumber")} className={thLink}>Protocolo{sortIndicator("protocolNumber")}</Link>
                    </th>
                    <th className={thBase}>
                      <Link href={sortHref("typeName")} className={thLink}>Tipo{sortIndicator("typeName")}</Link>
                    </th>
                    <th className={thBase}>
                      <Link href={sortHref("courseNumber")} className={thLink}>Nº{sortIndicator("courseNumber")}</Link>
                    </th>
                    <th className={thBase}>
                      <Link href={sortHref("warName")} className={thLink}>Aluno{sortIndicator("warName")}</Link>
                    </th>
                    <th className={thBase}>
                      <Link href={sortHref("factDate")} className={thLink}>Data do Fato{sortIndicator("factDate")}</Link>
                    </th>
                    <th className={thBase}>
                      <Link href={sortHref("status")} className={thLink}>Status{sortIndicator("status")}</Link>
                    </th>
                    <th className="px-3 py-2.5 w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {grupo.itens.map((c) => {
                    const ds = derivedStatus(c);
                    return (
                      <tr key={c.id} className="hover:bg-gray-50">
                        <td className="px-3 py-2.5 font-mono text-xs text-gray-600 whitespace-nowrap">{c.protocolNumber}</td>
                        <td className="px-3 py-2.5 text-xs text-gray-600 whitespace-nowrap">{c.type.name}</td>
                        <td className="px-3 py-2.5 font-mono text-xs text-gray-500 whitespace-nowrap text-center">{c.courseNumber}</td>
                        <td className="px-3 py-2.5 font-medium text-gray-900 text-xs whitespace-nowrap">{c.student.warName}</td>
                        <td className="px-3 py-2.5 text-xs text-gray-500 whitespace-nowrap">{format(new Date(c.factDate), "dd/MM/yyyy", { locale: ptBR })}</td>
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ds.color}`}>{ds.label}</span>
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          <Link href={`/comunicacoes/${c.id}`} className="text-xs text-[#1e3a5f] hover:underline font-medium">Ver</Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}

      {/* Paginação */}
      {totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-2 mb-8">
          <p className="text-sm text-gray-500">
            Mostrando {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, totalComms)} de {totalComms} registro(s)
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

      {/* ── Comunicações registradas como comunicante (CFO EsFO) ────────── */}
      {isEsfoCFO && (() => {
        const regOrdem: string[] = [];
        const regPorCurso = new Map<string, { nome: string; itens: typeof comunicacoesRegistradas }>();
        for (const c of comunicacoesRegistradas) {
          const cid = c.courseId;
          if (!regPorCurso.has(cid)) { regOrdem.push(cid); regPorCurso.set(cid, { nome: c.course.name, itens: [] }); }
          regPorCurso.get(cid)!.itens.push(c);
        }
        return (
          <div className="mt-10">
            <div className="flex items-start justify-between mb-5 flex-wrap gap-4">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Comunicações que registrei</h1>
                <p className="text-sm text-gray-500">{comunicacoesRegistradas.length} registro(s)</p>
              </div>
              <div className="flex gap-2 flex-wrap">
                <Link href="/comunicacoes/nova/cpi" className="bg-[#1e3a5f] text-white px-4 py-2 rounded-lg text-sm hover:bg-[#16304f] transition-colors">+ Nova CPI</Link>
                <Link href="/comunicacoes/nova/referencia" className="border border-[#1e3a5f] text-[#1e3a5f] px-4 py-2 rounded-lg text-sm hover:bg-blue-50 transition-colors">+ Ref. Elogiosa</Link>
              </div>
            </div>

            {comunicacoesRegistradas.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-200 px-6 py-10 text-center text-gray-400">
                Você ainda não registrou nenhuma comunicação como comunicante.
              </div>
            ) : (
              regOrdem.map((cid) => {
                const grupo = regPorCurso.get(cid)!;
                return (
                  <div key={cid} className="mb-8">
                    {regOrdem.length > 1 && (
                      <div className="flex items-center gap-3 mb-2">
                        <h2 className="text-base font-bold text-[#1e3a5f] uppercase tracking-wide">{grupo.nome}</h2>
                        <span className="text-xs text-gray-400 font-normal">{grupo.itens.length} registro(s)</span>
                      </div>
                    )}
                    <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
                      <table className="w-full text-sm min-w-max">
                        <thead className="bg-gray-50 border-b border-gray-200">
                          <tr>
                            <th className={thBase}>Protocolo</th>
                            <th className={thBase}>Tipo</th>
                            <th className={thBase}>Nº</th>
                            <th className={thBase}>Aluno comunicado</th>
                            <th className={thBase}>Data do Fato</th>
                            <th className={thBase}>Status</th>
                            <th className="px-3 py-2.5 w-10"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {grupo.itens.map((c) => {
                            const ds = derivedStatus(c);
                            return (
                              <tr key={c.id} className="hover:bg-gray-50">
                                <td className="px-3 py-2.5 font-mono text-xs text-gray-600 whitespace-nowrap">{c.protocolNumber}</td>
                                <td className="px-3 py-2.5 text-xs text-gray-600 whitespace-nowrap">{c.type.name}</td>
                                <td className="px-3 py-2.5 font-mono text-xs text-gray-500 whitespace-nowrap text-center">{c.courseNumber}</td>
                                <td className="px-3 py-2.5 font-medium text-gray-900 text-xs whitespace-nowrap">{c.student.warName}</td>
                                <td className="px-3 py-2.5 text-xs text-gray-500 whitespace-nowrap">{format(new Date(c.factDate), "dd/MM/yyyy", { locale: ptBR })}</td>
                                <td className="px-3 py-2.5 whitespace-nowrap">
                                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ds.color}`}>{ds.label}</span>
                                </td>
                                <td className="px-3 py-2.5 whitespace-nowrap">
                                  <Link href={`/comunicacoes/${c.id}`} className="text-xs text-[#1e3a5f] hover:underline font-medium">Ver</Link>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        );
      })()}
    </div>
  );
}
