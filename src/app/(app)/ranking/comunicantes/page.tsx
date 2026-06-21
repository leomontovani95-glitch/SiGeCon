import { prisma } from "@/lib/db";
import { verifyRole, getSchoolFilter } from "@/lib/dal";
import type { UserRole } from "@/lib/dal";
import { abreviarPelotao } from "@/lib/utils";
import Link from "next/link";

const ALLOWED: UserRole[] = [
  "ADMINISTRADOR", "CHEFE_DIVISAO_ACADEMICA",
  "COMANDANTE_APM", "SUBCOMANDANTE_APM",
  "COMANDANTE_ESFAP", "COMANDANTE_ESFO",
  "SUBCOMANDANTE_ESFAP", "SUBCOMANDANTE_ESFO",
  "OFICIAL_ESFAP", "OFICIAL_ESFO",
];

const TIPOS_FILTRO = ["CPI 1", "CPI 2", "CPI 3", "Referência Elogiosa"];
const PER_PAGE = 20;
const TEXT_COLS = new Set(["posto", "nome", "rg", "nf", "curso", "pelotao", "numcurso"]);

type CommEntry = {
  key: string;
  communicantName: string;
  user: {
    id: string; rank: string; warName: string; fullName: string;
    rg: string; functionalNumber: string; role: string;
    student: {
      id: string;
      courseNumber: string;
      course: { name: string };
      platoon: { name: string } | null;
    } | null;
  } | null;
  total: number;
  counts: Record<string, number>;
};

function getSortValue(e: CommEntry, sortBy: string): string | number {
  const u = e.user;
  switch (sortBy) {
    case "posto":    return (u?.rank ?? parseRankFromName(e.communicantName)).toLowerCase();
    case "nome":     return (u?.warName ?? parseNameFromCombined(e.communicantName)).toLowerCase();
    case "rg":       return u?.rg ?? "";
    case "nf":       return u?.functionalNumber ?? "";
    case "curso":    return u?.student?.course.name ?? "";
    case "pelotao":  return u?.student?.platoon?.name ?? "";
    case "numcurso": return u?.student?.courseNumber ?? "";
    case "cpi1":     return e.counts["CPI 1"] ?? 0;
    case "cpi2":     return e.counts["CPI 2"] ?? 0;
    case "cpi3":     return e.counts["CPI 3"] ?? 0;
    case "ref":      return e.counts["Referência Elogiosa"] ?? 0;
    default:         return e.total;
  }
}

export default async function RankingComunicantesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const session = await verifyRole(...ALLOWED);
  const sp = await searchParams;

  const busca   = (sp.busca   ?? "").trim().toLowerCase();
  const tipo    = (sp.tipo    ?? "").trim();
  const pagina  = Math.max(1, parseInt(sp.pagina  ?? "1") || 1);
  const sortBy  = sp.sortBy  ?? "total";
  const sortDir = sp.sortDir === "asc" ? "asc" : "desc";

  const school = getSchoolFilter(session.role, session.escola);

  const comms = await prisma.communication.findMany({
    where: {
      communicantName: { not: null },
      ...(school ? { course: { school } } : {}),
    },
    select: {
      communicantUserId: true,
      communicantName: true,
      type: { select: { name: true } },
      communicantUser: {
        select: {
          id: true, rank: true, warName: true, fullName: true,
          rg: true, functionalNumber: true, role: true,
          student: {
            select: {
              id: true,
              courseNumber: true,
              course: { select: { name: true } },
              platoon: { select: { name: true } },
            },
          },
        },
      },
    },
  });

  // Aggregate by communicant
  const map = new Map<string, CommEntry>();
  for (const c of comms) {
    const key      = c.communicantUserId ?? `manual:${c.communicantName}`;
    const typeName = c.type.name;
    if (!map.has(key)) {
      map.set(key, {
        key,
        communicantName: c.communicantName ?? "",
        user: c.communicantUser ?? null,
        total: 0,
        counts: {},
      });
    }
    const entry = map.get(key)!;
    entry.total++;
    entry.counts[typeName] = (entry.counts[typeName] ?? 0) + 1;
  }

  let entries = Array.from(map.values());

  // Apply tipo filter
  if (tipo && TIPOS_FILTRO.includes(tipo)) {
    entries = entries.filter((e) => (e.counts[tipo] ?? 0) > 0);
  }

  // Apply search filter
  if (busca) {
    entries = entries.filter((e) => {
      const nome = (e.user?.warName ?? e.communicantName).toLowerCase();
      const full = (e.user?.fullName ?? "").toLowerCase();
      const rank = (e.user?.rank ?? "").toLowerCase();
      return nome.includes(busca) || full.includes(busca) || rank.includes(busca);
    });
  }

  // Sort
  entries.sort((a, b) => {
    const av = getSortValue(a, sortBy);
    const bv = getSortValue(b, sortBy);
    const dir = sortDir === "asc" ? 1 : -1;
    if (typeof av === "number" && typeof bv === "number") return (av - bv) * dir;
    return String(av).localeCompare(String(bv), "pt-BR") * dir;
  });

  const total        = entries.length;
  const totalPaginas = Math.max(1, Math.ceil(total / PER_PAGE));
  const paginaAtual  = Math.min(pagina, totalPaginas);
  const paginated    = entries.slice((paginaAtual - 1) * PER_PAGE, paginaAtual * PER_PAGE);

  // ── URL builders ──────────────────────────────────────────────────────────
  function buildUrl(overrides: Record<string, string>) {
    const p = new URLSearchParams({
      ...(busca   ? { busca }           : {}),
      ...(tipo    ? { tipo }            : {}),
      ...(sortBy  !== "total" ? { sortBy }  : {}),
      ...(sortDir !== "desc"  ? { sortDir } : {}),
      pagina: String(paginaAtual),
      ...overrides,
    });
    if (p.get("pagina") === "1") p.delete("pagina");
    const s = p.toString();
    return `/ranking/comunicantes${s ? `?${s}` : ""}`;
  }

  function sortLink(col: string) {
    const newDir = sortBy === col
      ? (sortDir === "asc" ? "desc" : "asc")
      : (TEXT_COLS.has(col) ? "asc" : "desc");
    return buildUrl({ sortBy: col, sortDir: newDir, pagina: "1" });
  }

  function sortIcon(col: string) {
    if (sortBy !== col) return <span className="text-gray-300 text-xs ml-1">↕</span>;
    return <span className="text-blue-300 text-xs ml-1">{sortDir === "desc" ? "↓" : "↑"}</span>;
  }

  // ── Célula de cabeçalho (helper de render, não um componente) ─────────────
  function thCell({ col, label, center }: { col: string; label: string; center?: boolean }) {
    const active = sortBy === col;
    return (
      <th className={`px-3 py-3 text-xs font-semibold whitespace-nowrap ${center ? "text-center" : "text-left"}`}>
        <Link
          href={sortLink(col)}
          className={`inline-flex items-center gap-0.5 hover:text-white transition-colors ${
            active ? "text-white" : "text-gray-400"
          }`}
        >
          {label}{sortIcon(col)}
        </Link>
      </th>
    );
  }

  // Parâmetros de exportação (PDF/CSV): refletem busca, tipo e ordenação atuais.
  const exportParams = new URLSearchParams({
    ...(busca   ? { busca }   : {}),
    ...(tipo    ? { tipo }    : {}),
    ...(sortBy  !== "total" ? { sortBy }  : {}),
    ...(sortDir !== "desc"  ? { sortDir } : {}),
  }).toString();

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Ranking de Comunicantes</h1>
          <p className="text-sm text-gray-500 mt-1">
            Usuários e alunos que mais apareceram como comunicante. Clique em qualquer título para ordenar.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href={`/ranking/comunicantes/imprimir${exportParams ? `?${exportParams}` : ""}`}
            target="_blank"
            className="bg-[#1e3a5f] text-white px-4 py-2 rounded-lg text-sm hover:bg-[#16304f] transition-colors flex items-center gap-2"
          >
            <span>📄</span> Gerar PDF
          </Link>
          <a
            href={`/api/export/comunicantes${exportParams ? `?${exportParams}` : ""}`}
            className="border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm hover:bg-gray-50 transition-colors flex items-center gap-2"
          >
            <span>⬇</span> Exportar CSV
          </a>
        </div>
      </div>

      {/* Filtros */}
      <form method="GET" className="flex flex-wrap gap-3 items-end">
        <input type="hidden" name="sortBy"  value={sortBy} />
        <input type="hidden" name="sortDir" value={sortDir} />
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Buscar</label>
          <input
            name="busca"
            defaultValue={busca}
            placeholder="Nome de guerra, posto..."
            className="input text-sm w-56"
            autoComplete="off"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Tipo de registro</label>
          <select name="tipo" defaultValue={tipo} className="input text-sm">
            <option value="">Todos os tipos</option>
            {TIPOS_FILTRO.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
        <button type="submit" className="btn-primary text-sm">Filtrar</button>
        {(busca || tipo) && (
          <a href={buildUrl({ busca: "", tipo: "", pagina: "1" })} className="btn-secondary text-sm">
            Limpar
          </a>
        )}
      </form>

      {/* Contador */}
      <p className="text-sm text-gray-500">
        {total === 0
          ? "Nenhum comunicante encontrado."
          : `${total} comunicante${total !== 1 ? "s" : ""} — página ${paginaAtual} de ${totalPaginas}`}
      </p>

      {/* Tabela */}
      {paginated.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-[#1e3a5f] border-b border-[#16304f]">
              <tr>
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-400 w-10">#</th>
                {thCell({ col: "posto",    label: "Posto/Grad" })}
                {thCell({ col: "nome",     label: "Nome de guerra" })}
                {thCell({ col: "rg",       label: "RG" })}
                {thCell({ col: "nf",       label: "NF" })}
                {thCell({ col: "curso",    label: "Curso" })}
                {thCell({ col: "pelotao",  label: "Pel." })}
                {thCell({ col: "numcurso", label: "Nº Curso", center: true })}
                {thCell({ col: "total",    label: "Total",    center: true })}
                {thCell({ col: "cpi1",     label: "CPI 1",    center: true })}
                {thCell({ col: "cpi2",     label: "CPI 2",    center: true })}
                {thCell({ col: "cpi3",     label: "CPI 3",    center: true })}
                {thCell({ col: "ref",      label: "Ref. Elogiosa", center: true })}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {paginated.map((e, idx) => {
                const pos    = (paginaAtual - 1) * PER_PAGE + idx + 1;
                const u      = e.user;
                const isAluno  = u?.role === "ALUNO";
                const isManual = !u;

                const posto      = u?.rank ?? (isManual ? parseRankFromName(e.communicantName) : "—");
                const nomeGuerra = u?.warName ?? (isManual ? parseNameFromCombined(e.communicantName) : e.communicantName);
                const rg         = u?.rg ?? "—";
                const nf         = u?.functionalNumber ?? "—";
                const curso      = isAluno ? (u.student?.course.name ?? "—") : "—";
                const pelotao    = isAluno ? (u.student?.platoon?.name ?? "—") : "—";
                const numCurso   = isAluno ? (u.student?.courseNumber ?? "—") : "—";

                return (
                  <tr key={e.key} className={`hover:bg-gray-50 ${isManual ? "bg-amber-50/30" : ""}`}>
                    <td className="px-3 py-2.5 text-gray-400 font-mono text-xs text-center">{pos}</td>
                    <td className="px-3 py-2.5">
                      <span className="inline-block bg-gray-100 text-gray-700 text-xs font-mono px-1.5 py-0.5 rounded">
                        {posto}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 font-medium text-gray-900 whitespace-nowrap">
                      {!isManual ? (
                        <Link
                          href={isAluno && u!.student?.id ? `/alunos/${u!.student.id}` : `/usuarios/${u!.id}`}
                          className="hover:text-[#1e3a5f] hover:underline"
                        >
                          {nomeGuerra}
                        </Link>
                      ) : (
                        <>
                          {nomeGuerra}
                          <span className="ml-1.5 text-xs text-amber-600 font-normal">(manual)</span>
                        </>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-gray-600 font-mono text-xs whitespace-nowrap">{rg}</td>
                    <td className="px-3 py-2.5 text-gray-600 font-mono text-xs whitespace-nowrap">{nf}</td>
                    <td className="px-3 py-2.5 text-gray-600 text-xs whitespace-nowrap">{curso}</td>
                    <td className="px-3 py-2.5 text-gray-600 text-xs whitespace-nowrap">{abreviarPelotao(pelotao)}</td>
                    <td className="px-3 py-2.5 text-gray-600 text-xs text-center">{numCurso}</td>
                    <td className="px-3 py-2.5 text-center">
                      <span className="font-bold text-gray-900">{e.total}</span>
                    </td>
                    <td className="px-3 py-2.5 text-center font-semibold text-red-700">
                      {e.counts["CPI 1"] ?? 0}
                    </td>
                    <td className="px-3 py-2.5 text-center font-semibold text-red-700">
                      {e.counts["CPI 2"] ?? 0}
                    </td>
                    <td className="px-3 py-2.5 text-center font-semibold text-red-700">
                      {e.counts["CPI 3"] ?? 0}
                    </td>
                    <td className="px-3 py-2.5 text-center font-semibold text-green-700">
                      {e.counts["Referência Elogiosa"] ?? 0}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Paginação */}
      {totalPaginas > 1 && (
        <div className="flex items-center gap-2 flex-wrap">
          {paginaAtual > 1 && (
            <Link href={buildUrl({ pagina: String(paginaAtual - 1) })}
              className="btn-secondary text-sm px-3 py-1.5">
              ← Anterior
            </Link>
          )}
          {Array.from({ length: totalPaginas }, (_, i) => i + 1)
            .filter((p) => Math.abs(p - paginaAtual) <= 2 || p === 1 || p === totalPaginas)
            .reduce<(number | "...")[]>((acc, p, i, arr) => {
              if (i > 0 && p - (arr[i - 1] as number) > 1) acc.push("...");
              acc.push(p);
              return acc;
            }, [])
            .map((p, i) =>
              p === "..." ? (
                <span key={`el-${i}`} className="px-2 text-gray-400">…</span>
              ) : (
                <Link
                  key={p}
                  href={buildUrl({ pagina: String(p) })}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    p === paginaAtual
                      ? "bg-[#1e3a5f] text-white"
                      : "bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  {p}
                </Link>
              )
            )}
          {paginaAtual < totalPaginas && (
            <Link href={buildUrl({ pagina: String(paginaAtual + 1) })}
              className="btn-secondary text-sm px-3 py-1.5">
              Próxima →
            </Link>
          )}
        </div>
      )}

      {paginated.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          <p className="text-4xl mb-2">📋</p>
          <p>Nenhum comunicante registrado ainda.</p>
        </div>
      )}
    </div>
  );
}

// Helpers para entradas manuais (communicantName = "RANK NOME")
function parseRankFromName(combined: string): string {
  const POSTOS = [
    "TEN CEL", "1º TEN", "2º TEN", "ASP OF", "AL OF", "AL SD",
    "CEL", "MAJ", "CAP", "SUBTEN", "1º SGT", "2º SGT", "3º SGT",
    "CB", "SD", "OUTRO (CIVIL)",
  ];
  const upper = combined.trim().toUpperCase();
  for (const p of POSTOS) {
    if (upper.startsWith(p)) return p;
  }
  return combined.trim().split(/\s+/)[0] ?? "—";
}

function parseNameFromCombined(combined: string): string {
  const rank = parseRankFromName(combined);
  if (!rank || rank === "—") return combined;
  return combined.trim().slice(rank.length).trim() || combined;
}
