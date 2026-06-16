import { prisma } from "@/lib/db";
import { verifySession, getSchoolFilter } from "@/lib/dal";
import { redirect } from "next/navigation";
import { calcularNotaPublicada, faixaNota } from "@/lib/score";
import { abreviarPelotao } from "@/lib/utils";
import PrintLayout from "@/components/PrintLayout";

const ORDENS_VALIDAS = ["desc", "asc", "numAsc", "numDesc"] as const;
type Ordem = typeof ORDENS_VALIDAS[number];

const ORDEM_LABELS: Record<Ordem, string> = {
  desc:    "Nota (maior → menor)",
  asc:     "Nota (menor → maior)",
  numAsc:  "Número (crescente)",
  numDesc: "Número (decrescente)",
};

const FAIXAS = ["Excelente", "Bom", "Regular", "Atenção", "Reprovado"] as const;
const FAIXA_CORES: Record<string, string> = {
  Excelente: "#166534",
  Bom:       "#15803d",
  Regular:   "#92400e",
  Atenção:   "#b91c1c",
  Reprovado: "#7f1d1d",
};

export default async function RankingImprimirPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const session = await verifySession();
  if (session.role === "ALUNO") redirect("/acesso-negado");

  const sp = await searchParams;
  const cursoId = sp.cursoId ?? "";
  const ordem: Ordem = ORDENS_VALIDAS.includes(sp.ordem as Ordem) ? (sp.ordem as Ordem) : "desc";

  const school = getSchoolFilter(session.role, session.escola);

  const cursosDisponiveis = await prisma.course.findMany({
    where: { active: true, ...(school ? { school } : {}) },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  const scopeIds = cursoId
    ? [cursoId]
    : cursosDisponiveis.map((c) => c.id);

  const rankingStudents = await prisma.student.findMany({
    where: { status: "ATIVO", courseId: { in: scopeIds } },
    include: { course: true, platoon: true },
  });
  // Notas agregadas por aluno (studentId): o histórico acompanha o remanescente.
  const publishedItems = await prisma.disciplinaryBookItem.findMany({
    where: {
      disciplinaryBook: { status: "PUBLICADO" },
      studentId: { in: rankingStudents.map((s) => s.id) },
    },
    include: {
      communication: { include: { type: { select: { scoreNature: true } } } },
    },
  });

  const pubPorAluno = new Map<string, typeof publishedItems>();
  for (const item of publishedItems) {
    if (!pubPorAluno.has(item.studentId)) pubPorAluno.set(item.studentId, []);
    pubPorAluno.get(item.studentId)!.push(item);
  }

  const ranking = rankingStudents
    .map((a) => ({
      warName:      a.warName,
      fullName:     a.fullName,
      courseNumber: a.courseNumber,
      courseName:   a.course.name,
      platoonName:  a.platoon?.name ?? null,
      nota:         calcularNotaPublicada(pubPorAluno.get(a.id) ?? []),
    }))
    .sort((a, b) => {
      if (ordem === "numAsc" || ordem === "numDesc") {
        const na = parseInt(a.courseNumber, 10) || 0;
        const nb = parseInt(b.courseNumber, 10) || 0;
        return ordem === "numAsc" ? na - nb : nb - na;
      }
      return ordem === "asc" ? a.nota - b.nota : b.nota - a.nota;
    });

  const cursoSelecionado = cursosDisponiveis.find((c) => c.id === cursoId);
  const labelEscopo = school === "ESFAP" ? "EsFAP" : school === "ESFO" ? "EsFO" : "Todos os cursos";
  const escopo = cursoSelecionado?.name ?? labelEscopo;

  // Contagem por faixa para o resumo
  const faixaCount: Record<string, number> = { Excelente: 0, Bom: 0, Regular: 0, Atenção: 0, Reprovado: 0 };
  for (const a of ranking) faixaCount[faixaNota(a.nota).label]++;

  return (
    <PrintLayout title={`Ranking de Conduta — ${escopo}`}>
      <div className="print-section">
        <h2>Ranking de Conduta</h2>
        <p style={{ fontSize: "9pt", color: "#555", marginBottom: "10px" }}>
          {escopo} · {ranking.length} aluno(s) · ordenação: {ORDEM_LABELS[ordem]} · notas baseadas nos cadernos publicados
        </p>

        {/* Resumo por faixa */}
        <div style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "6px",
          marginBottom: "14px",
          padding: "8px 10px",
          border: "1px solid #e5e7eb",
          borderRadius: "6px",
          backgroundColor: "#f9fafb",
        }}>
          <span style={{ fontSize: "8pt", color: "#374151", fontWeight: "bold", marginRight: "4px", alignSelf: "center" }}>
            Total: {ranking.length}
          </span>
          {FAIXAS.map((f) => (
            <span
              key={f}
              style={{
                fontSize: "8pt",
                padding: "2px 8px",
                borderRadius: "4px",
                border: `1px solid ${FAIXA_CORES[f]}`,
                color: FAIXA_CORES[f],
                fontWeight: "bold",
              }}
            >
              {f}: {faixaCount[f]}
            </span>
          ))}
        </div>
      </div>

      {ranking.length === 0 ? (
        <p style={{ fontSize: "10pt", color: "#666", textAlign: "center", marginTop: "40px" }}>
          Nenhum aluno encontrado no escopo selecionado.
        </p>
      ) : (
        <table className="print-table">
          <thead>
            <tr>
              <th style={{ textAlign: "center" }}>Pos.</th>
              <th style={{ textAlign: "center" }}>Nº</th>
              <th>Nome de Guerra</th>
              <th>Nome Completo</th>
              <th>Pel.</th>
              <th style={{ textAlign: "center" }}>Faixa</th>
              <th style={{ textAlign: "right" }}>Nota</th>
            </tr>
          </thead>
          <tbody>
            {ranking.map((a, idx) => {
              const faixa = faixaNota(a.nota);
              const corFaixa = FAIXA_CORES[faixa.label];
              return (
                <tr key={a.warName + a.courseNumber}>
                  <td style={{ textAlign: "center", fontWeight: "bold", color: "#6b7280" }}>{idx + 1}º</td>
                  <td style={{ textAlign: "center", fontFamily: "monospace" }}>{a.courseNumber}</td>
                  <td style={{ fontWeight: "bold" }}>{a.warName}</td>
                  <td style={{ fontSize: "8pt", color: "#374151" }}>{a.fullName}</td>
                  <td style={{ fontSize: "8pt", color: "#6b7280", whiteSpace: "nowrap" }}>{abreviarPelotao(a.platoonName)}</td>
                  <td style={{ textAlign: "center", fontSize: "8pt", fontWeight: "bold", color: corFaixa }}>
                    {faixa.label}
                  </td>
                  <td style={{ textAlign: "right", fontWeight: "bold", fontSize: "10pt", color: corFaixa }}>
                    {a.nota.toFixed(2)}
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
