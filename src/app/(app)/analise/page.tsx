import { prisma } from "@/lib/db";
import { verifySession, getSchoolFilter } from "@/lib/dal";
import { redirect } from "next/navigation";
import Link from "next/link";
import AnaliseCharts from "./AnaliseCharts";

export default async function AnalisePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const session = await verifySession();
  if (session.role === "ALUNO") redirect("/acesso-negado");

  const sp         = await searchParams;
  const cursoId    = sp.cursoId    ?? "";
  const platoonId  = sp.platoonId  ?? "";
  const dataInicio = sp.dataInicio ?? "";
  const dataFim    = sp.dataFim    ?? "";
  const adaptacao  = sp.adaptacao  ?? "";

  const school = getSchoolFilter(session.role, session.escola);

  const [cursosDisponiveis, platoesDisponiveis] = await Promise.all([
    prisma.course.findMany({
      where: { active: true, ...(school ? { school } : {}) },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    cursoId
      ? prisma.platoon.findMany({
          where: { courseId: cursoId, active: true },
          orderBy: { name: "asc" },
          select: { id: true, name: true },
        })
      : Promise.resolve([] as { id: string; name: string }[]),
  ]);

  const courseFilter = cursoId
    ? { courseId: cursoId }
    : school
      ? { course: { school } }
      : {};

  const platoonFilter = platoonId ? { platoonId } : {};

  const dateFilter =
    dataInicio || dataFim
      ? {
          factDate: {
            ...(dataInicio ? { gte: new Date(dataInicio) } : {}),
            ...(dataFim    ? { lte: new Date(dataFim)    } : {}),
          },
        }
      : {};

  const adaptationFilter = adaptacao === "sim" ? { adaptationPeriod: true } : adaptacao === "nao" ? { adaptationPeriod: false } : {};
  const where = { ...courseFilter, ...platoonFilter, ...dateFilter, ...adaptationFilter };

  const allComms = await prisma.communication.findMany({
    where,
    select: {
      id:        true,
      factDate:  true,
      article:   true,
      item:      true,
      letter:    true,
      studentId: true,
      type: {
        select: { name: true, score: true, scoreNature: true },
      },
      student: {
        select: {
          warName: true,
          platoon: { select: { name: true } },
          course:  { select: { name: true } },
        },
      },
      platoon: { select: { name: true } },
    },
  });

  const total = allComms.length;

  // ── 1. Frequência por dia da semana ──────────────────────────────────────
  const diasNomes = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
  const diasCount = new Array(7).fill(0) as number[];
  for (const c of allComms) {
    diasCount[new Date(c.factDate).getDay()]++;
  }
  const diaSemanaData = diasNomes.map((dia, i) => ({ dia, total: diasCount[i] }));

  // ── 2. Evolução mensal ────────────────────────────────────────────────────
  const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  const monthlyMap = new Map<string, { CPI: number; refElogiosa: number }>();
  for (const c of allComms) {
    const d   = new Date(c.factDate);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const prev = monthlyMap.get(key) ?? { CPI: 0, refElogiosa: 0 };
    if (c.type.scoreNature === "DESFAVORAVEL") prev.CPI++;
    else prev.refElogiosa++;
    monthlyMap.set(key, prev);
  }

  // Comparação com o mesmo período do ano anterior (requer ambas as datas)
  let prevMonthlyMap: Map<string, { CPI: number; refElogiosa: number }> | null = null;
  if (dataInicio && dataFim) {
    const prevStart = new Date(dataInicio);
    prevStart.setFullYear(prevStart.getFullYear() - 1);
    const prevEnd = new Date(dataFim);
    prevEnd.setFullYear(prevEnd.getFullYear() - 1);
    const prevComms = await prisma.communication.findMany({
      where: { ...courseFilter, ...platoonFilter, factDate: { gte: prevStart, lte: prevEnd } },
      select: { factDate: true, type: { select: { scoreNature: true } } },
    });
    prevMonthlyMap = new Map();
    for (const c of prevComms) {
      const d   = new Date(c.factDate);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const prev = prevMonthlyMap.get(key) ?? { CPI: 0, refElogiosa: 0 };
      if (c.type.scoreNature === "DESFAVORAVEL") prev.CPI++;
      else prev.refElogiosa++;
      prevMonthlyMap.set(key, prev);
    }
  }

  const evolucaoMensalData = Array.from(monthlyMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, val]) => {
      const [year, month] = key.split("-");
      const prevKey = `${parseInt(year) - 1}-${month}`;
      const prevVal = prevMonthlyMap?.get(prevKey);
      return {
        mes:             `${MESES[parseInt(month) - 1]}/${year.slice(2)}`,
        CPI:             val.CPI,
        "Ref. Elogiosa": val.refElogiosa,
        ...(prevVal !== undefined
          ? { "CPI (ano ant.)": prevVal.CPI, "Ref. Elogiosa (ano ant.)": prevVal.refElogiosa }
          : {}),
      };
    });

  // ── 3. Comparativo entre pelotões ─────────────────────────────────────────
  const pelotaoMap = new Map<string, { cpi0: number; cpi1: number; cpi2: number; cpi3: number }>();
  for (const c of allComms) {
    if (!c.type.name.toLowerCase().includes("cpi")) continue;
    const pelotao = c.platoon?.name ?? c.student.platoon?.name ?? "Sem pelotão";
    const prev    = pelotaoMap.get(pelotao) ?? { cpi0: 0, cpi1: 0, cpi2: 0, cpi3: 0 };
    const grau    = Math.min(3, Math.max(0, Math.round(c.type.score)));
    if (grau === 0)      prev.cpi0++;
    else if (grau === 1) prev.cpi1++;
    else if (grau === 2) prev.cpi2++;
    else                 prev.cpi3++;
    pelotaoMap.set(pelotao, prev);
  }
  const pelotaoData = Array.from(pelotaoMap.entries())
    .map(([pelotao, cnt]) => ({
      pelotao,
      ...cnt,
      total: cnt.cpi0 + cnt.cpi1 + cnt.cpi2 + cnt.cpi3,
    }))
    .sort((a, b) => b.total - a.total);

  // ── 4. Distribuição por tipo ───────────────────────────────────────────────
  const tipoMap = new Map<string, number>();
  for (const c of allComms) {
    tipoMap.set(c.type.name, (tipoMap.get(c.type.name) ?? 0) + 1);
  }
  const tipoData = Array.from(tipoMap.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  // ── 5. Top artigos infringidos ─────────────────────────────────────────────
  const artigoMap = new Map<string, number>();
  for (const c of allComms) {
    if (!c.article) continue;
    const key = `Art. ${c.article}${c.item ? ` Inc. ${c.item}` : ""}${c.letter ? ` Al. ${c.letter}` : ""}`;
    artigoMap.set(key, (artigoMap.get(key) ?? 0) + 1);
  }
  const topArtigos = Array.from(artigoMap.entries())
    .map(([dispositivo, count]) => ({ dispositivo, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // ── 6. Top 10 alunos ──────────────────────────────────────────────────────
  const alunoMap = new Map<string, { studentId: string; warName: string; courseName: string; platoonName: string; total: number }>();
  for (const c of allComms) {
    const prev = alunoMap.get(c.studentId);
    if (prev) {
      prev.total++;
    } else {
      alunoMap.set(c.studentId, {
        studentId:   c.studentId,
        warName:     c.student.warName,
        courseName:  c.student.course.name,
        platoonName: c.student.platoon?.name ?? "—",
        total: 1,
      });
    }
  }
  const topAlunos = Array.from(alunoMap.values())
    .sort((a, b) => b.total - a.total)
    .slice(0, 10);

  // ── Helpers ────────────────────────────────────────────────────────────────
  const labelEscopo = school === "ESFAP" ? "Todos da EsFAP"
    : school === "ESFO"  ? "Todos da EsFO"
    : "Todos os cursos";
  const cursoSelecionado  = cursosDisponiveis.find((c) => c.id === cursoId);
  const plataoSelecionado = platoesDisponiveis.find((p) => p.id === platoonId);

  function pillHref(id: string) {
    const p = new URLSearchParams();
    if (id)         p.set("cursoId",    id);
    if (dataInicio) p.set("dataInicio", dataInicio);
    if (dataFim)    p.set("dataFim",    dataFim);
    if (adaptacao)  p.set("adaptacao",  adaptacao);
    // platoonId é intencionalmente descartado ao trocar o curso
    const qs = p.toString();
    return `/analise${qs ? `?${qs}` : ""}`;
  }

  function platoonPillHref(pid: string) {
    const p = new URLSearchParams();
    if (cursoId)    p.set("cursoId",    cursoId);
    if (pid)        p.set("platoonId",  pid);
    if (dataInicio) p.set("dataInicio", dataInicio);
    if (dataFim)    p.set("dataFim",    dataFim);
    if (adaptacao)  p.set("adaptacao",  adaptacao);
    const qs = p.toString();
    return `/analise${qs ? `?${qs}` : ""}`;
  }

  function clearDatesHref() {
    const p = new URLSearchParams();
    if (cursoId)   p.set("cursoId",   cursoId);
    if (platoonId) p.set("platoonId", platoonId);
    if (adaptacao) p.set("adaptacao", adaptacao);
    const qs = p.toString();
    return `/analise${qs ? `?${qs}` : ""}`;
  }

  function pdfHref() {
    const p = new URLSearchParams();
    if (cursoId)    p.set("cursoId",    cursoId);
    if (platoonId)  p.set("platoonId",  platoonId);
    if (dataInicio) p.set("dataInicio", dataInicio);
    if (dataFim)    p.set("dataFim",    dataFim);
    if (adaptacao)  p.set("adaptacao",  adaptacao);
    const qs = p.toString();
    return `/analise/imprimir${qs ? `?${qs}` : ""}`;
  }

  function csvHref() {
    const p = new URLSearchParams();
    if (cursoId)    p.set("cursoId",    cursoId);
    if (platoonId)  p.set("platoonId",  platoonId);
    if (dataInicio) p.set("dataInicio", dataInicio);
    if (dataFim)    p.set("dataFim",    dataFim);
    if (adaptacao)  p.set("adaptacao",  adaptacao);
    const qs = p.toString();
    return `/api/export/analise${qs ? `?${qs}` : ""}`;
  }

  return (
    <div className="p-6">
      {/* Cabeçalho */}
      <div className="flex items-start justify-between mb-5 flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Análise</h1>
          <p className="text-sm text-gray-500">
            {cursoSelecionado ? cursoSelecionado.name : labelEscopo}
            {plataoSelecionado ? ` · ${plataoSelecionado.name}` : ""}
            {" · "}{total} comunicação(ões) considerada(s)
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <a
            href={csvHref()}
            className="border border-[#1e3a5f] text-[#1e3a5f] px-4 py-2 rounded-lg text-sm hover:bg-[#1e3a5f] hover:text-white transition-colors flex items-center gap-2"
          >
            <span>⬇</span> Exportar CSV
          </a>
          <Link
            href={pdfHref()}
            target="_blank"
            className="bg-[#1e3a5f] text-white px-4 py-2 rounded-lg text-sm hover:bg-[#16304f] transition-colors flex items-center gap-2"
          >
            <span>📄</span> Gerar PDF
          </Link>
        </div>
      </div>

      {/* Seletor de cursos */}
      {cursosDisponiveis.length > 1 && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-5">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Filtrar por curso
          </p>
          <div className="flex flex-wrap gap-2">
            <Link
              href={pillHref("")}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                !cursoId
                  ? "bg-[#1e3a5f] text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              {labelEscopo}
            </Link>
            {cursosDisponiveis.map((curso) => (
              <Link
                key={curso.id}
                href={pillHref(curso.id)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  cursoId === curso.id
                    ? "bg-[#1e3a5f] text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                {curso.name}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Seletor de pelotões */}
      {cursoId && platoesDisponiveis.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-5">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Filtrar por pelotão
          </p>
          <div className="flex flex-wrap gap-2">
            <Link
              href={platoonPillHref("")}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                !platoonId
                  ? "bg-[#1e3a5f] text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              Todos os pelotões
            </Link>
            {platoesDisponiveis.map((p) => (
              <Link
                key={p.id}
                href={platoonPillHref(p.id)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  platoonId === p.id
                    ? "bg-[#1e3a5f] text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                {p.name}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Filtro de período */}
      <form method="GET" className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
        {cursoId   && <input type="hidden" name="cursoId"   value={cursoId} />}
        {platoonId && <input type="hidden" name="platoonId" value={platoonId} />}
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
          Filtrar por período
          {dataInicio && dataFim && (
            <span className="ml-2 text-xs font-normal text-blue-600 normal-case">
              — gráfico mensal exibe comparação com o mesmo período do ano anterior
            </span>
          )}
        </p>
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Data início</label>
            <input
              name="dataInicio"
              type="date"
              defaultValue={dataInicio}
              className="input text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Data fim</label>
            <input
              name="dataFim"
              type="date"
              defaultValue={dataFim}
              className="input text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Período de Adaptação</label>
            <select name="adaptacao" defaultValue={adaptacao} className="input text-sm">
              <option value="">Todos</option>
              <option value="sim">Sim</option>
              <option value="nao">Não</option>
            </select>
          </div>
          <button type="submit" className="btn-primary">
            Aplicar
          </button>
          {(dataInicio || dataFim) && (
            <Link
              href={clearDatesHref()}
              className="text-xs text-gray-500 hover:text-gray-700 underline self-center"
            >
              Limpar período
            </Link>
          )}
        </div>
      </form>

      {/* Gráficos */}
      <AnaliseCharts
        total={total}
        diaSemanaData={diaSemanaData}
        evolucaoMensalData={evolucaoMensalData}
        pelotaoData={pelotaoData}
        tipoData={tipoData}
        topArtigos={topArtigos}
        topAlunos={topAlunos}
      />
    </div>
  );
}
