import { prisma } from "@/lib/db";
import { verifySession, getSchoolFilter } from "@/lib/dal";
import { redirect } from "next/navigation";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import PrintLayout from "@/components/PrintLayout";

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
    AGUARDANDO_CIENCIA: "Ag. Ciência/Defesa",
    AGUARDANDO_DEFESA: "Ag. Ciência/Defesa",
    PRAZO_EXPIRADO: "Prazo Expirado",
    JUSTIFICATIVA_APRESENTADA: "Defesa Apresentada",
    AGUARDANDO_PARECER: "Ag. Parecer",
    AGUARDANDO_DECISAO: "Ag. Decisão",
    ARQUIVADA: "Arquivada",
  };
  return map[c.status] ?? c.status.replace(/_/g, " ");
}

export default async function RelatoriosImprimirPage({
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

  const school = getSchoolFilter(session.role, session.escola);

  const cursosDisponiveis = await prisma.course.findMany({
    where: { active: true, ...(school ? { school } : {}) },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  const cursoFilter = cursoId
    ? { courseId: cursoId }
    : school
      ? { course: { school } }
      : {};

  const where: Record<string, unknown> = { ...cursoFilter };
  if (tipo) where.type = { name: tipo };

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

  const comunicacoes = await prisma.communication.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      type: true,
      student: { include: { course: true } },
      decisions: true,
      disciplinaryBookItems: { include: { disciplinaryBook: { select: { status: true } } } },
    },
    take: 500,
  });

  const cursoSelecionado = cursosDisponiveis.find((c) => c.id === cursoId);
  const labelEscopo = school === "ESFAP" ? "EsFAP" : school === "ESFO" ? "EsFO" : "Todos os cursos";
  const escopo = cursoSelecionado?.name ?? labelEscopo;

  const filtros: string[] = [escopo];
  if (tipo)       filtros.push(`Tipo: ${tipo}`);
  if (status)     filtros.push(`Status: ${status}`);
  if (dataInicio) filtros.push(`De: ${dataInicio}`);
  if (dataFim)    filtros.push(`Até: ${dataFim}`);

  const total         = comunicacoes.length;
  const desfavoraveis = comunicacoes.filter((c) => c.type.scoreNature === "DESFAVORAVEL").length;
  const favoraveis    = comunicacoes.filter((c) => c.type.scoreNature === "FAVORAVEL").length;

  return (
    <PrintLayout title={`Relatório de Comunicações — ${escopo}`}>
      <div className="print-section">
        <h2>Relatório de Comunicações</h2>
        <p style={{ fontSize: "9pt", color: "#555", marginBottom: "12px" }}>{filtros.join("  ·  ")}</p>
        <div style={{ display: "flex", gap: "24px", marginBottom: "16px", fontSize: "9pt" }}>
          <span><strong>{total}</strong> total</span>
          <span style={{ color: "#991b1b" }}><strong>{desfavoraveis}</strong> desfavoráveis</span>
          <span style={{ color: "#166534" }}><strong>{favoraveis}</strong> favoráveis</span>
        </div>
      </div>

      {comunicacoes.length === 0 ? (
        <p style={{ fontSize: "10pt", color: "#666", textAlign: "center", marginTop: "40px" }}>
          Nenhuma comunicação encontrada com os filtros aplicados.
        </p>
      ) : (
        <table className="print-table">
          <thead>
            <tr>
              <th>Protocolo</th>
              <th>Tipo</th>
              <th>Aluno</th>
              <th>Curso</th>
              <th>Data Fato</th>
              <th>Status</th>
              <th style={{ textAlign: "right" }}>Pont.</th>
            </tr>
          </thead>
          <tbody>
            {comunicacoes.map((c) => {
              const statusLabel = resolveStatusLabel(c);
              const desfav = c.type.scoreNature === "DESFAVORAVEL";
              return (
                <tr key={c.id}>
                  <td style={{ fontFamily: "monospace", fontSize: "8pt" }}>{c.protocolNumber}</td>
                  <td>{c.type.name}</td>
                  <td style={{ fontWeight: "bold" }}>{c.student.warName}</td>
                  <td>{c.student.course.name}</td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    {format(new Date(c.factDate), "dd/MM/yyyy", { locale: ptBR })}
                  </td>
                  <td>
                    <span
                      className={`print-badge ${desfav ? "badge-desfav" : "badge-fav"}`}
                      style={{ color: statusLabel.includes("Arquiv") ? "#374151" : undefined,
                               background: statusLabel.includes("Arquiv") ? "#f3f4f6" : undefined }}
                    >
                      {statusLabel}
                    </span>
                  </td>
                  <td style={{ textAlign: "right", fontWeight: "bold",
                               color: c.finalScore != null && c.finalScore > 0 ? "#991b1b" :
                                      c.finalScore != null && c.finalScore < 0 ? "#166534" : "#6b7280" }}>
                    {c.finalScore != null ? `${c.finalScore > 0 ? "−" : c.finalScore < 0 ? "+" : ""}${Math.abs(c.finalScore).toFixed(1)}` : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </PrintLayout>
  );
}
