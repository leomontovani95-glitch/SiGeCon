import { NextRequest, NextResponse } from "next/server";
import { verifySession, getSchoolFilter } from "@/lib/dal";
import type { UserRole } from "@/lib/dal";
import { prisma } from "@/lib/db";

const ALLOWED: UserRole[] = [
  "ADMINISTRADOR", "CHEFE_DIVISAO_ACADEMICA",
  "COMANDANTE_APM", "SUBCOMANDANTE_APM",
  "COMANDANTE_ESFAP", "COMANDANTE_ESFO",
  "SUBCOMANDANTE_ESFAP", "SUBCOMANDANTE_ESFO",
  "OFICIAL_ESFAP", "OFICIAL_ESFO",
];

const TIPOS_FILTRO = ["CPI 1", "CPI 2", "CPI 3", "Referência Elogiosa"];

type CommEntry = {
  communicantName: string;
  user: {
    rank: string; warName: string; fullName: string;
    rg: string; functionalNumber: string; role: string;
    student: {
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

export async function GET(req: NextRequest) {
  const session = await verifySession();
  if (!ALLOWED.includes(session.role as UserRole)) {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const busca   = (searchParams.get("busca") ?? "").trim().toLowerCase();
  const tipo    = (searchParams.get("tipo") ?? "").trim();
  const sortBy  = searchParams.get("sortBy") ?? "total";
  const sortDir = searchParams.get("sortDir") === "asc" ? "asc" : "desc";

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
          rank: true, warName: true, fullName: true,
          rg: true, functionalNumber: true, role: true,
          student: {
            select: {
              courseNumber: true,
              course: { select: { name: true } },
              platoon: { select: { name: true } },
            },
          },
        },
      },
    },
  });

  const map = new Map<string, CommEntry>();
  for (const c of comms) {
    const key      = c.communicantUserId ?? `manual:${c.communicantName}`;
    const typeName = c.type.name;
    if (!map.has(key)) {
      map.set(key, {
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

  const header = "Posição,Posto/Grad,Nome de Guerra,Nome Completo,RG,NF,Curso,Pelotão,Nº Curso,Total,CPI 1,CPI 2,CPI 3,Ref. Elogiosa\r\n";
  const body = entries
    .map((e, i) => {
      const u        = e.user;
      const isAluno  = u?.role === "ALUNO";
      const isManual = !u;
      const posto      = u?.rank ?? (isManual ? parseRankFromName(e.communicantName) : "");
      const nomeGuerra = u?.warName ?? (isManual ? parseNameFromCombined(e.communicantName) : e.communicantName);
      const fullName   = u?.fullName ?? (isManual ? `${nomeGuerra} (manual)` : "");
      const rg         = u?.rg ?? "";
      const nf         = u?.functionalNumber ?? "";
      const curso      = isAluno ? (u.student?.course.name ?? "") : "";
      const pelotao    = isAluno ? (u.student?.platoon?.name ?? "") : "";
      const numCurso   = isAluno ? (u.student?.courseNumber ?? "") : "";
      return [
        i + 1,
        `"${posto}"`, `"${nomeGuerra}"`, `"${fullName}"`, `"${rg}"`, `"${nf}"`,
        `"${curso}"`, `"${pelotao}"`, `"${numCurso}"`,
        e.total,
        e.counts["CPI 1"] ?? 0,
        e.counts["CPI 2"] ?? 0,
        e.counts["CPI 3"] ?? 0,
        e.counts["Referência Elogiosa"] ?? 0,
      ].join(",");
    })
    .join("\r\n");

  return new NextResponse(header + body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="ranking-comunicantes.csv"`,
    },
  });
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
  return combined.trim().split(/\s+/)[0] ?? "";
}

function parseNameFromCombined(combined: string): string {
  const rank = parseRankFromName(combined);
  if (!rank) return combined;
  return combined.trim().slice(rank.length).trim() || combined;
}
