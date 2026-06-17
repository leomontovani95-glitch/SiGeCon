import { NextRequest, NextResponse } from "next/server";
import { verifySession, getSchoolFilter } from "@/lib/dal";
import { normalizeSituacaoCurso, courseScopeWhere } from "@/lib/cursos";
import { prisma } from "@/lib/db";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export async function GET(req: NextRequest) {
  const session = await verifySession();
  if (session.role === "ALUNO") {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const cursoId    = searchParams.get("cursoId")    ?? "";
  const platoonId  = searchParams.get("platoonId")  ?? "";
  const dataInicio = searchParams.get("dataInicio") ?? "";
  const dataFim    = searchParams.get("dataFim")    ?? "";
  const situacao   = normalizeSituacaoCurso(searchParams.get("situacao") ?? undefined);

  const school = getSchoolFilter(session.role, session.escola);
  const courseFilter = courseScopeWhere(situacao, school, cursoId);
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

  const where = { ...courseFilter, ...platoonFilter, ...dateFilter };

  const comunicacoes = await prisma.communication.findMany({
    where,
    orderBy: { factDate: "asc" },
    select: {
      protocolNumber: true,
      factDate:       true,
      article:        true,
      item:           true,
      letter:         true,
      finalScore:     true,
      type:    { select: { name: true, scoreNature: true } },
      student: {
        select: {
          warName:      true,
          courseNumber: true,
          course:  { select: { name: true } },
          platoon: { select: { name: true } },
        },
      },
      platoon: { select: { name: true } },
    },
  });

  const header = "Protocolo,Tipo,Natureza,Aluno,Nº Curso,Pelotão,Curso,Data do Fato,Artigo,Pontuação Final\r\n";
  const body = comunicacoes.map((c) => {
    const dataFato  = format(new Date(c.factDate), "dd/MM/yyyy", { locale: ptBR });
    const pelotao   = c.platoon?.name ?? c.student.platoon?.name ?? "";
    const artigo    = c.article
      ? `Art. ${c.article}${c.item ? ` Inc. ${c.item}` : ""}${c.letter ? ` Al. ${c.letter}` : ""}`
      : "";
    const natureza  = c.type.scoreNature === "DESFAVORAVEL" ? "CPI/Desfavorável" : "Ref. Elogiosa/Favorável";
    return [
      `"${c.protocolNumber}"`,
      `"${c.type.name}"`,
      `"${natureza}"`,
      `"${c.student.warName}"`,
      `"${c.student.courseNumber}"`,
      `"${pelotao}"`,
      `"${c.student.course.name}"`,
      `"${dataFato}"`,
      `"${artigo}"`,
      c.finalScore != null ? c.finalScore.toFixed(1) : "",
    ].join(",");
  }).join("\r\n");

  const ts = format(new Date(), "yyyyMMdd_HHmm", { locale: ptBR });

  return new NextResponse(header + body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="analise_${ts}.csv"`,
    },
  });
}
