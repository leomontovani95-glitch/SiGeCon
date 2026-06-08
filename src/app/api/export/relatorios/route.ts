import { NextRequest, NextResponse } from "next/server";
import { verifySession, getSchoolFilter } from "@/lib/dal";
import { prisma } from "@/lib/db";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

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
    AGUARDANDO_CIENCIA: "Ag. Ciência/Defesa", AGUARDANDO_DEFESA: "Ag. Ciência/Defesa",
    PRAZO_EXPIRADO: "Prazo Expirado", JUSTIFICATIVA_APRESENTADA: "Defesa Apresentada",
    AGUARDANDO_PARECER: "Ag. Parecer", AGUARDANDO_DECISAO: "Ag. Decisão", ARQUIVADA: "Arquivada",
  };
  return map[c.status] ?? c.status.replace(/_/g, " ");
}

export async function GET(req: NextRequest) {
  const session = await verifySession();
  if (session.role === "ALUNO") {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const cursoId    = searchParams.get("cursoId")    ?? "";
  const tipo       = searchParams.get("tipo")       ?? "";
  const status     = searchParams.get("status")     ?? "";
  const dataInicio = searchParams.get("dataInicio") ?? "";
  const dataFim    = searchParams.get("dataFim")    ?? "";
  const artigo     = searchParams.get("artigo")     ?? "";
  const inciso     = searchParams.get("inciso")     ?? "";
  const alinea     = searchParams.get("alinea")     ?? "";

  const school = getSchoolFilter(session.role, session.escola);
  const cursoFilter = cursoId ? { courseId: cursoId } : school ? { course: { school } } : {};
  const where: Record<string, unknown> = { ...cursoFilter };

  if (tipo)   where.type = { name: tipo };
  if (artigo) where.article = artigo;
  if (inciso) where.item = inciso;
  if (alinea) where.letter = alinea;

  if (status) {
    switch (status) {
      case "DECIDIDA_PUBLICADA":
        Object.assign(where, { OR: [{ status: "PUBLICADA_CADERNO" }, { status: "DECIDIDA", disciplinaryBookItems: { some: { disciplinaryBook: { status: "PUBLICADO" } } } }] });
        break;
      case "DECIDIDA_NAO_PUBLICADA":
        Object.assign(where, { status: "DECIDIDA", disciplinaryBookItems: { none: { disciplinaryBook: { status: "PUBLICADO" } } }, decisions: { none: { decisionType: { contains: "rquiv" } } } });
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

  const comunicacoes = await prisma.communication.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      type: true,
      student: { include: { course: true, platoon: true } },
      decisions: true,
      disciplinaryBookItems: { include: { disciplinaryBook: { select: { status: true } } } },
    },
  });

  const header = "Protocolo,Tipo,Artigo,Inciso,Alínea,Aluno,Nº Curso,Pelotão,Curso,Data do Fato,Status,Pontuação\r\n";
  const body = comunicacoes.map((c) => {
    const statusLabel = resolveStatusLabel(c);
    const dataFato = format(new Date(c.factDate), "dd/MM/yyyy", { locale: ptBR });
    return [
      `"${c.protocolNumber}"`,
      `"${c.type.name}"`,
      `"${c.article ?? ""}"`,
      `"${c.item ?? ""}"`,
      `"${c.letter ?? ""}"`,
      `"${c.student.warName}"`,
      `"${c.courseNumber}"`,
      `"${c.student.platoon?.name ?? ""}"`,
      `"${c.student.course.name}"`,
      `"${dataFato}"`,
      `"${statusLabel}"`,
      c.finalScore != null ? c.finalScore.toFixed(1) : "",
    ].join(",");
  }).join("\r\n");

  const ts = format(new Date(), "yyyyMMdd_HHmm", { locale: ptBR });

  return new NextResponse(header + body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="relatorios_${ts}.csv"`,
    },
  });
}
