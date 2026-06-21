import { prisma } from "@/lib/db";
import { verifySession, getSchoolFilter } from "@/lib/dal";
import type { UserRole } from "@/lib/dal";
import { abreviarPelotao, escolaHeaderLabel } from "@/lib/utils";
import { redirect } from "next/navigation";
import PrintLayout from "@/components/PrintLayout";

const ALLOWED: UserRole[] = [
  "ADMINISTRADOR", "CHEFE_DIVISAO_ACADEMICA",
  "COMANDANTE_APM", "SUBCOMANDANTE_APM",
  "COMANDANTE_ESFAP", "COMANDANTE_ESFO",
  "SUBCOMANDANTE_ESFAP", "SUBCOMANDANTE_ESFO",
  "OFICIAL_ESFAP", "OFICIAL_ESFO",
];

const TIPOS_FILTRO = ["CPI 1", "CPI 2", "CPI 3", "Referência Elogiosa"];

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

export default async function RankingComunicantesImprimirPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const session = await verifySession();
  if (!ALLOWED.includes(session.role as UserRole)) redirect("/acesso-negado");

  const sp = await searchParams;
  const busca   = (sp.busca   ?? "").trim().toLowerCase();
  const tipo    = (sp.tipo    ?? "").trim();
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

  // Agrega por comunicante
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

  if (tipo && TIPOS_FILTRO.includes(tipo)) {
    entries = entries.filter((e) => (e.counts[tipo] ?? 0) > 0);
  }

  if (busca) {
    entries = entries.filter((e) => {
      const nome = (e.user?.warName ?? e.communicantName).toLowerCase();
      const full = (e.user?.fullName ?? "").toLowerCase();
      const rank = (e.user?.rank ?? "").toLowerCase();
      return nome.includes(busca) || full.includes(busca) || rank.includes(busca);
    });
  }

  entries.sort((a, b) => {
    const av = getSortValue(a, sortBy);
    const bv = getSortValue(b, sortBy);
    const dir = sortDir === "asc" ? 1 : -1;
    if (typeof av === "number" && typeof bv === "number") return (av - bv) * dir;
    return String(av).localeCompare(String(bv), "pt-BR") * dir;
  });

  const labelEscopo = school === "ESFAP" ? "EsFAP" : school === "ESFO" ? "EsFO" : "Todas as escolas";
  const filtroTexto = [
    busca ? `busca: "${busca}"` : null,
    tipo ? `tipo: ${tipo}` : null,
  ].filter(Boolean).join(" · ");

  const extraStyles = `
    @media print { @page { size: A4 landscape; } }
    .rc-table { width: 100%; border-collapse: separate; border-spacing: 0; font-size: 8pt; border: 1px solid #000; border-radius: 6px; }
    .rc-table th { background: #1e3a5f; color: white; padding: 5px 6px; text-align: left; font-size: 7.5pt; text-transform: uppercase; border-right: 1px solid #000; border-bottom: 1px solid #000; }
    .rc-table td { padding: 4px 6px; border-right: 1px solid #000; border-bottom: 1px solid #000; }
    .rc-table tr > *:last-child { border-right: none; }
    .rc-table tbody tr:last-child td { border-bottom: none; }
    .rc-table thead th:first-child { border-top-left-radius: 5px; }
    .rc-table thead th:last-child { border-top-right-radius: 5px; }
    .rc-table tbody tr:last-child td:first-child { border-bottom-left-radius: 5px; }
    .rc-table tbody tr:last-child td:last-child { border-bottom-right-radius: 5px; }
    .rc-table tr:nth-child(even) td { background: #f9fafb; }
    .rc-num { font-family: monospace; }
  `;

  return (
    <PrintLayout
      title="Ranking de Comunicantes"
      escola={escolaHeaderLabel(school)}
      extraStyles={extraStyles}
    >
      <div className="print-section">
        <h2>Ranking de Comunicantes</h2>
        <p style={{ fontSize: "9pt", color: "#000", marginBottom: "10px" }}>
          {labelEscopo} · {entries.length} comunicante(s){filtroTexto ? ` · ${filtroTexto}` : ""}
        </p>
      </div>

      {entries.length === 0 ? (
        <p style={{ fontSize: "10pt", color: "#000", textAlign: "center", marginTop: "40px" }}>
          Nenhum comunicante encontrado no escopo selecionado.
        </p>
      ) : (
        <table className="rc-table">
          <thead>
            <tr>
              <th style={{ textAlign: "center" }}>#</th>
              <th>Posto/Grad</th>
              <th>Nome de Guerra</th>
              <th>RG</th>
              <th>NF</th>
              <th>Curso</th>
              <th>Pel.</th>
              <th style={{ textAlign: "center" }}>Nº Curso</th>
              <th style={{ textAlign: "center" }}>Total</th>
              <th style={{ textAlign: "center" }}>CPI 1</th>
              <th style={{ textAlign: "center" }}>CPI 2</th>
              <th style={{ textAlign: "center" }}>CPI 3</th>
              <th style={{ textAlign: "center" }}>Ref. Elog.</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e, idx) => {
              const u        = e.user;
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
                <tr key={e.key}>
                  <td style={{ textAlign: "center", color: "#000" }}>{idx + 1}</td>
                  <td className="rc-num">{posto}</td>
                  <td style={{ fontWeight: "bold" }}>
                    {nomeGuerra}{isManual ? <span style={{ color: "#b45309", fontWeight: "normal" }}> (manual)</span> : null}
                  </td>
                  <td className="rc-num">{rg}</td>
                  <td className="rc-num">{nf}</td>
                  <td>{curso}</td>
                  <td style={{ whiteSpace: "nowrap" }}>{abreviarPelotao(pelotao)}</td>
                  <td style={{ textAlign: "center" }}>{numCurso}</td>
                  <td style={{ textAlign: "center", fontWeight: "bold" }}>{e.total}</td>
                  <td style={{ textAlign: "center", color: "#b91c1c" }}>{e.counts["CPI 1"] ?? 0}</td>
                  <td style={{ textAlign: "center", color: "#b91c1c" }}>{e.counts["CPI 2"] ?? 0}</td>
                  <td style={{ textAlign: "center", color: "#b91c1c" }}>{e.counts["CPI 3"] ?? 0}</td>
                  <td style={{ textAlign: "center", color: "#15803d" }}>{e.counts["Referência Elogiosa"] ?? 0}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </PrintLayout>
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
