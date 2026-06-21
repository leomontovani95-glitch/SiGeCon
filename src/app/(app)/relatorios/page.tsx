import { prisma } from "@/lib/db";
import { verifySession, getSchoolFilter } from "@/lib/dal";
import { normalizeSituacaoCurso, activeWhereCurso, courseScopeWhere, buildSituacaoOptions } from "@/lib/cursos";
import SituacaoCursoFilter from "@/components/SituacaoCursoFilter";
import { redirect } from "next/navigation";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import Link from "next/link";

const PER_PAGE       = 50;
const ARTIGOS_POR_PAG = 5;

function resolveStatusLabel(c: {
  status: string;
  decisions: { decisionType: string }[];
  disciplinaryBookItems: { disciplinaryBook: { status: string } }[];
}): string {
  if (c.status === "PUBLICADA_CADERNO") return "Decidida/Publicada";
  if (c.status === "DECIDIDA") {
    const arq = c.decisions.some((d) => d.decisionType.toLowerCase().includes("arquiv"));
    if (arq) return "Arquivada";
    const pub = c.disciplinaryBookItems.some((i) => i.disciplinaryBook.status === "PUBLICADO");
    return pub ? "Decidida/Publicada" : "Decidida/Não publicada";
  }
  const map: Record<string, string> = {
    AGUARDANDO_CIENCIA:        "Ag. Ciência/Defesa",
    AGUARDANDO_DEFESA:         "Ag. Ciência/Defesa",
    PRAZO_EXPIRADO:            "Prazo Expirado",
    JUSTIFICATIVA_APRESENTADA: "Defesa Apresentada",
    AGUARDANDO_PARECER:        "Ag. Parecer",
    AGUARDANDO_DECISAO:        "Ag. Decisão",
    AGUARDANDO_DECISAO_DIVISAO:"Ag. Decisão (Div. Acadêmica)",
    ARQUIVADA:                 "Arquivada",
  };
  return map[c.status] ?? c.status.replace(/_/g, " ");
}

export default async function RelatoriosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const session = await verifySession();
  if (session.role === "ALUNO") redirect("/acesso-negado");

  const sp = await searchParams;
  const cursoId    = sp.cursoId    ?? "";
  const tipo       = sp.tipo       ?? "";
  const status     = sp.status     ?? "";
  const dataInicio = sp.dataInicio ?? "";
  const dataFim    = sp.dataFim    ?? "";
  const artigo     = sp.artigo     ?? "";
  const inciso     = sp.inciso     ?? "";
  const alinea     = sp.alinea     ?? "";
  const pagina     = Math.max(1, parseInt(sp.pagina ?? "1") || 1);
  const paginaArt  = Math.max(1, parseInt(sp.paginaArt ?? "1") || 1);
  const col        = sp.col  ?? "";
  const dir        = (sp.dir === "asc" ? "asc" : "desc") as "asc" | "desc";
  const adaptacao  = sp.adaptacao ?? "";
  const situacao   = normalizeSituacaoCurso(sp.situacao);  // ativos | inativos | todos

  const school = getSchoolFilter(session.role, session.escola);

  const cursosDisponiveis = await prisma.course.findMany({
    where: { ...activeWhereCurso(situacao), ...(school ? { school } : {}) },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  const cursoFilter = courseScopeWhere(situacao, school, cursoId);

  const where: Record<string, unknown> = { ...cursoFilter };
  if (tipo)   where.type = { name: tipo };
  if (artigo) where.article = artigo;
  if (inciso) where.item = inciso;
  if (alinea) where.letter = alinea;
  if (adaptacao === "sim") where.adaptationPeriod = true;
  else if (adaptacao === "nao") where.adaptationPeriod = false;

  if (status) {
    switch (status) {
      case "DECIDIDA_PUBLICADA":
        Object.assign(where, {
          OR: [
            { status: "PUBLICADA_CADERNO" },
            { status: "DECIDIDA", disciplinaryBookItems: { some: { disciplinaryBook: { status: "PUBLICADO" } } } },
          ],
        });
        break;
      case "DECIDIDA_NAO_PUBLICADA":
        Object.assign(where, {
          status: "DECIDIDA",
          disciplinaryBookItems: { none: { disciplinaryBook: { status: "PUBLICADO" } } },
          decisions: { none: { decisionType: { contains: "rquiv" } } },
        });
        break;
      case "ARQUIVADA_DEC":
        Object.assign(where, { status: "DECIDIDA", decisions: { some: { decisionType: { contains: "rquiv" } } } });
        break;
      default:
        where.status = status;
    }
  }

  if (dataInicio || dataFim) {
    where.factDate = {};
    if (dataInicio) (where.factDate as Record<string, unknown>).gte = new Date(dataInicio);
    if (dataFim)    (where.factDate as Record<string, unknown>).lte = new Date(dataFim);
  }

  // Filtro para o ranking de artigos (sem filtro de artigo/inciso/alínea)
  const whereFreq: Record<string, unknown> = { ...cursoFilter };
  if (tipo) whereFreq.type = { name: tipo };
  if (dataInicio || dataFim) whereFreq.factDate = where.factDate;
  if (adaptacao === "sim") whereFreq.adaptationPeriod = true;
  else if (adaptacao === "nao") whereFreq.adaptationPeriod = false;
  if (status) {
    const statusWhere: Record<string, unknown> = {};
    Object.assign(statusWhere, where.status ? { status: where.status } : {});
    Object.assign(whereFreq, statusWhere);
  }

  const COLS: Record<string, object> = {
    protocolNumber: { protocolNumber: dir },
    tipo:           { type: { name: dir } },
    dispositivo:    { article: dir },
    aluno:          { student: { warName: dir } },
    curso:          { student: { course: { name: dir } } },
    data:           { factDate: dir },
    status:         { status: dir },
    pontuacao:      { finalScore: dir },
  };

  const orderBy = col && COLS[col]
    ? [COLS[col], { createdAt: "desc" as const }]
    : [{ createdAt: "desc" as const }];

  const [totalCount, comunicacoes, tipos, commsParaFreq] = await Promise.all([
    prisma.communication.count({ where }),
    prisma.communication.findMany({
      where,
      orderBy,
      include: {
        type: true,
        student: { include: { course: true } },
        reporter: true,
        decisions: true,
        disciplinaryBookItems: { include: { disciplinaryBook: { select: { status: true } } } },
        manualRule: { select: { description: true } },
      },
      take: PER_PAGE,
      skip: (pagina - 1) * PER_PAGE,
    }),
    prisma.communicationType.findMany({ orderBy: { name: "asc" } }),
    prisma.communication.findMany({
      where: whereFreq,
      select: { article: true, item: true, letter: true, manualRule: { select: { description: true } } },
    }),
  ]);

  // ── Ranking de artigos ────────────────────────────────────────────────────
  const freqMap = new Map<string, { count: number; desc?: string }>();
  for (const c of commsParaFreq) {
    if (!c.article) continue;
    const key = `Art. ${c.article}${c.item ? ` Inc. ${c.item}` : ""}${c.letter ? ` Al. ${c.letter}` : ""}`;
    const prev = freqMap.get(key);
    freqMap.set(key, { count: (prev?.count ?? 0) + 1, desc: prev?.desc ?? c.manualRule?.description });
  }
  const rankingArtigosTotal = Array.from(freqMap.entries()).sort((a, b) => b[1].count - a[1].count);
  const totalPaginasArt = Math.max(1, Math.ceil(rankingArtigosTotal.length / ARTIGOS_POR_PAG));
  const paginaArtAtual  = Math.min(paginaArt, totalPaginasArt);
  const rankingArtigos  = rankingArtigosTotal.slice((paginaArtAtual - 1) * ARTIGOS_POR_PAG, paginaArtAtual * ARTIGOS_POR_PAG);
  const maxFreq         = rankingArtigosTotal[0]?.[1].count ?? 1;

  const totalPaginas = Math.max(1, Math.ceil(totalCount / PER_PAGE));
  const paginaAtual  = Math.min(pagina, totalPaginas);
  const inicio       = (paginaAtual - 1) * PER_PAGE;

  const desfavoraveis = comunicacoes.filter((c) => c.type.scoreNature === "DESFAVORAVEL").length;
  const favoraveis    = comunicacoes.filter((c) => c.type.scoreNature === "FAVORAVEL").length;

  const cursoSelecionado = cursosDisponiveis.find((c) => c.id === cursoId);
  const labelEscopo = school === "ESFAP" ? "Todos da EsFAP"
    : school === "ESFO"  ? "Todos da EsFO"
    : "Todos os cursos";

  function buildQS(overrides: Record<string, string | number> = {}) {
    const p = new URLSearchParams();
    if (cursoId)    p.set("cursoId",    cursoId);
    if (tipo)       p.set("tipo",       tipo);
    if (status)     p.set("status",     status);
    if (dataInicio) p.set("dataInicio", dataInicio);
    if (dataFim)    p.set("dataFim",    dataFim);
    if (artigo)     p.set("artigo",     artigo);
    if (inciso)     p.set("inciso",     inciso);
    if (alinea)     p.set("alinea",     alinea);
    if (adaptacao)  p.set("adaptacao",  adaptacao);
    if (situacao !== "ativos") p.set("situacao", situacao);
    if (col)        p.set("col",        col);
    if (dir)        p.set("dir",        dir);
    p.set("pagina",    String(paginaAtual));
    p.set("paginaArt", String(paginaArtAtual));
    for (const [k, v] of Object.entries(overrides)) {
      if (v !== "") p.set(k, String(v)); else p.delete(k);
    }
    return p.toString();
  }

  function sortHref(newCol: string) {
    const newDir = col === newCol && dir === "asc" ? "desc" : "asc";
    return `/relatorios?${buildQS({ col: newCol, dir: newDir, pagina: 1 })}`;
  }

  function sortIndicator(c: string) {
    if (col !== c) return <span className="text-gray-300 group-hover:text-gray-500 ml-0.5">↕</span>;
    return <span className="text-[#1e3a5f] ml-0.5">{dir === "asc" ? "↑" : "↓"}</span>;
  }

  function pillHref(id: string) {
    const qs = buildQS({ cursoId: id, pagina: 1, paginaArt: 1 });
    return `/relatorios${qs ? `?${qs}` : ""}`;
  }

  // Situação do curso: trocar reinicia curso selecionado e paginação.
  const situacaoOptions = buildSituacaoOptions(situacao, (k) => {
    const qs = buildQS({ situacao: k === "ativos" ? "" : k, cursoId: "", pagina: 1, paginaArt: 1 });
    return `/relatorios${qs ? `?${qs}` : ""}`;
  });

  function pdfHref() {
    const qs = buildQS();
    return `/relatorios/imprimir${qs ? `?${qs}` : ""}`;
  }

  function csvHref() {
    const p = new URLSearchParams();
    if (cursoId)    p.set("cursoId",    cursoId);
    if (tipo)       p.set("tipo",       tipo);
    if (status)     p.set("status",     status);
    if (dataInicio) p.set("dataInicio", dataInicio);
    if (dataFim)    p.set("dataFim",    dataFim);
    if (artigo)     p.set("artigo",     artigo);
    if (inciso)     p.set("inciso",     inciso);
    if (alinea)     p.set("alinea",     alinea);
    if (situacao !== "ativos") p.set("situacao", situacao);
    const qs = p.toString();
    return `/api/export/relatorios${qs ? `?${qs}` : ""}`;
  }

  const temFiltroArtigo = artigo || inciso || alinea;

  return (
    <div className="p-6">
      {/* Título */}
      <div className="flex items-start justify-between mb-5 flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Relatórios</h1>
          <p className="text-sm text-gray-500">
            {cursoSelecionado ? cursoSelecionado.name : labelEscopo}
            {" · "}{totalCount} resultado(s) no total
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Link href={pdfHref()} target="_blank"
            className="bg-[#1e3a5f] text-white px-4 py-2 rounded-lg text-sm hover:bg-[#16304f] transition-colors flex items-center gap-2">
            <span>📄</span> Gerar PDF
          </Link>
          <a href={csvHref()}
            className="border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm hover:bg-gray-50 transition-colors flex items-center gap-2">
            <span>⬇</span> Exportar CSV
          </a>
        </div>
      </div>

      {/* Situação do curso + Seletor de cursos (mesma barra de filtros) */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-5 space-y-4">
        <SituacaoCursoFilter options={situacaoOptions} />
        {cursosDisponiveis.length > 1 && (
          <div className="border-t border-gray-100 pt-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Filtrar por curso</p>
            <div className="flex flex-wrap gap-2">
              <Link href={pillHref("")}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${!cursoId ? "bg-[#1e3a5f] text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}>
                {labelEscopo}
              </Link>
              {cursosDisponiveis.map((curso) => (
                <Link key={curso.id} href={pillHref(curso.id)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${cursoId === curso.id ? "bg-[#1e3a5f] text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}>
                  {curso.name}
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Filtros */}
      <form method="GET" className="bg-white rounded-xl border border-gray-200 p-5 mb-6 space-y-4">
        {cursoId && <input type="hidden" name="cursoId" value={cursoId} />}
        {situacao !== "ativos" && <input type="hidden" name="situacao" value={situacao} />}
        <input type="hidden" name="pagina" value="1" />
        <input type="hidden" name="paginaArt" value="1" />

        <div className="flex flex-wrap gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Tipo</label>
            <select name="tipo" defaultValue={tipo} className="input text-sm">
              <option value="">Todos</option>
              {tipos.map((t) => <option key={t.id} value={t.name}>{t.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
            <select name="status" defaultValue={status} className="input text-sm">
              <option value="">Todos</option>
              <option value="AGUARDANDO_CIENCIA">Ag. Ciência/Defesa</option>
              <option value="PRAZO_EXPIRADO">Prazo Expirado</option>
              <option value="JUSTIFICATIVA_APRESENTADA">Defesa Apresentada</option>
              <option value="AGUARDANDO_PARECER">Ag. Parecer</option>
              <option value="AGUARDANDO_DECISAO">Ag. Decisão</option>
              <option value="AGUARDANDO_DECISAO_DIVISAO">Ag. Decisão (Div. Acadêmica)</option>
              <option value="DECIDIDA_PUBLICADA">Decidida/Publicada</option>
              <option value="DECIDIDA_NAO_PUBLICADA">Decidida/Não publicada</option>
              <option value="ARQUIVADA_DEC">Arquivada</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Data início</label>
            <input name="dataInicio" type="date" defaultValue={dataInicio} className="input text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Data fim</label>
            <input name="dataFim" type="date" defaultValue={dataFim} className="input text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Período de Adaptação</label>
            <select name="adaptacao" defaultValue={adaptacao} className="input text-sm">
              <option value="">Todos</option>
              <option value="sim">Sim</option>
              <option value="nao">Não</option>
            </select>
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Filtrar por Dispositivo Legal</p>
          <div className="flex flex-wrap gap-4 items-end">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Artigo</label>
              <input name="artigo" defaultValue={artigo} placeholder="ex: 14" className="input text-sm w-28" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Inciso</label>
              <input name="inciso" defaultValue={inciso} placeholder="ex: II" className="input text-sm w-28" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Alínea</label>
              <input name="alinea" defaultValue={alinea} placeholder="ex: a" className="input text-sm w-24" />
            </div>
            {temFiltroArtigo && (
              <div className="flex items-end pb-0.5">
                <a href={`/relatorios?${buildQS({ artigo: "", inciso: "", alinea: "", pagina: 1 })}`}
                  className="text-xs text-gray-500 hover:text-gray-700 underline">
                  Limpar dispositivo
                </a>
              </div>
            )}
          </div>
        </div>

        <div>
          <button type="submit" className="btn-primary">Filtrar</button>
        </div>
      </form>

      {/* ── Ranking de Artigos Mais Registrados ──────────────────────────────── */}
      {rankingArtigosTotal.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <h2 className="text-sm font-semibold text-gray-900">
              Artigos Mais Registrados
              {(tipo || dataInicio || dataFim) && (
                <span className="text-xs font-normal text-gray-500 ml-2">(considerando filtros de tipo e período)</span>
              )}
            </h2>
            <span className="text-xs text-gray-500">
              {rankingArtigosTotal.length} dispositivo(s) distintos
              {totalPaginasArt > 1 && ` · página ${paginaArtAtual} de ${totalPaginasArt}`}
            </span>
          </div>

          <div className="space-y-2 mb-4">
            {rankingArtigos.map(([dispositivo, { count, desc }]) => {
              const pct  = Math.round((count / maxFreq) * 100);
              const isAtivo = artigo && dispositivo.includes(`Art. ${artigo}`);
              return (
                <div key={dispositivo} className={`rounded-lg p-3 ${isAtivo ? "bg-blue-50 border border-blue-200" : "bg-gray-50"}`}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs font-semibold text-gray-800">{dispositivo}</span>
                      {desc && <span className="text-xs text-gray-500 truncate max-w-xs">{desc}</span>}
                    </div>
                    <span className="text-sm font-bold text-gray-900 ml-4 shrink-0">{count}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-1.5">
                    <div className="bg-[#1e3a5f] h-1.5 rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>

          {totalPaginasArt > 1 && (
            <div className="flex items-center gap-2 justify-end">
              {paginaArtAtual > 1 && (
                <Link href={`/relatorios?${buildQS({ paginaArt: paginaArtAtual - 1 })}`}
                  className="px-3 py-1 rounded-lg text-xs font-medium bg-white border border-gray-200 text-gray-700 hover:bg-gray-50">
                  ← Anterior
                </Link>
              )}
              <span className="text-xs text-gray-500">{paginaArtAtual} / {totalPaginasArt}</span>
              {paginaArtAtual < totalPaginasArt && (
                <Link href={`/relatorios?${buildQS({ paginaArt: paginaArtAtual + 1 })}`}
                  className="px-3 py-1 rounded-lg text-xs font-medium bg-white border border-gray-200 text-gray-700 hover:bg-gray-50">
                  Próxima →
                </Link>
              )}
            </div>
          )}
        </div>
      )}

      {/* Cards resumo */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Total",         value: totalCount,    color: "bg-blue-600" },
          { label: "Desfavoráveis", value: desfavoraveis, color: "bg-red-600" },
          { label: "Favoráveis",    value: favoraveis,    color: "bg-green-600" },
          { label: "Decididas",     value: comunicacoes.filter((c) => c.status === "DECIDIDA" || c.status === "PUBLICADA_CADERNO").length, color: "bg-teal-600" },
        ].map((card) => (
          <div key={card.label} className={`${card.color} rounded-xl p-4 text-white`}>
            <p className="text-2xl font-bold">{card.value}</p>
            <p className="text-xs mt-1 opacity-90">{card.label}</p>
          </div>
        ))}
      </div>

      {/* Tabela */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto mb-5">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <p className="text-xs text-gray-500">
            Mostrando {totalCount === 0 ? 0 : inicio + 1}–{Math.min(inicio + PER_PAGE, totalCount)} de {totalCount}
          </p>
          {totalPaginas > 1 && (
            <p className="text-xs text-gray-500">Página {paginaAtual} de {totalPaginas}</p>
          )}
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {(
                [
                  ["protocolNumber", "Protocolo"],
                  ["tipo",           "Tipo"],
                  ["dispositivo",    "Dispositivo"],
                  ["aluno",          "Aluno"],
                  ["curso",          "Curso"],
                  ["data",           "Data"],
                  ["status",         "Status"],
                  ["pontuacao",      "Pont."],
                ] as const
              ).map(([key, label]) => (
                <th key={key} className="text-left px-3 py-2.5 font-medium text-gray-700 text-xs whitespace-nowrap">
                  <Link
                    href={sortHref(key)}
                    className="inline-flex items-center gap-0.5 hover:text-[#1e3a5f] transition-colors cursor-pointer group select-none"
                  >
                    {label}{sortIndicator(key)}
                  </Link>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {comunicacoes.map((c) => {
              const dispositivo = c.article
                ? `Art. ${c.article}${c.item ? ` Inc. ${c.item}` : ""}${c.letter ? ` Al. ${c.letter}` : ""}`
                : "—";
              return (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-3 py-2.5 font-mono text-xs text-gray-700 whitespace-nowrap">
                    <Link href={`/comunicacoes/${c.id}`} className="hover:underline text-[#1e3a5f]">
                      {c.protocolNumber}
                    </Link>
                  </td>
                  <td className="px-3 py-2.5 text-xs text-gray-600 whitespace-nowrap">{c.type.name}</td>
                  <td className="px-3 py-2.5 text-xs font-mono text-gray-500 whitespace-nowrap">{dispositivo}</td>
                  <td className="px-3 py-2.5 text-xs font-medium text-gray-900 whitespace-nowrap">
                    <Link href={`/alunos/${c.student.id}`} className="hover:text-[#1e3a5f] hover:underline">{c.student.warName}</Link>
                  </td>
                  <td className="px-3 py-2.5 text-xs text-gray-500 whitespace-nowrap">{c.student.course.name}</td>
                  <td className="px-3 py-2.5 text-xs text-gray-500 whitespace-nowrap">
                    {format(new Date(c.factDate), "dd/MM/yyyy", { locale: ptBR })}
                  </td>
                  <td className="px-3 py-2.5 text-xs whitespace-nowrap">
                    {resolveStatusLabel(c)}
                    {c.adaptationPeriod && (
                      <span className="ml-1 text-xs px-1.5 py-0.5 rounded-full font-medium bg-orange-100 text-orange-700">PA</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-xs font-bold whitespace-nowrap">
                    {c.finalScore != null ? c.finalScore.toFixed(1) : "—"}
                  </td>
                </tr>
              );
            })}
            {comunicacoes.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-gray-400">
                  Nenhuma comunicação encontrada com os filtros aplicados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Paginação */}
      {totalPaginas > 1 && (
        <div className="flex items-center justify-center gap-2 flex-wrap">
          {paginaAtual > 1 && (
            <Link href={`/relatorios?${buildQS({ pagina: paginaAtual - 1 })}`}
              className="px-3 py-1.5 rounded-lg text-sm font-medium bg-white border border-gray-200 text-gray-700 hover:bg-gray-50">
              ← Anterior
            </Link>
          )}

          {Array.from({ length: Math.min(totalPaginas, 7) }, (_, i) => {
            const start = Math.max(1, Math.min(paginaAtual - 3, totalPaginas - 6));
            const p = start + i;
            if (p > totalPaginas) return null;
            return (
              <Link key={p} href={`/relatorios?${buildQS({ pagina: p })}`}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                  p === paginaAtual ? "bg-[#1e3a5f] text-white border-[#1e3a5f]" : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50"
                }`}>
                {p}
              </Link>
            );
          })}

          {paginaAtual < totalPaginas && (
            <Link href={`/relatorios?${buildQS({ pagina: paginaAtual + 1 })}`}
              className="px-3 py-1.5 rounded-lg text-sm font-medium bg-white border border-gray-200 text-gray-700 hover:bg-gray-50">
              Próxima →
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
