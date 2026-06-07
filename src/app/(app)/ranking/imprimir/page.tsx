import { prisma } from "@/lib/db";
import { verifySession, getSchoolFilter } from "@/lib/dal";
import { redirect } from "next/navigation";
import { calcularNotaPublicada, faixaNota } from "@/lib/score";
import PrintLayout from "@/components/PrintLayout";

export default async function RankingImprimirPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const session = await verifySession();
  if (session.role === "ALUNO") redirect("/acesso-negado");

  const sp = await searchParams;
  const cursoId = sp.cursoId ?? "";

  const school = getSchoolFilter(session.role, session.escola);

  const cursosDisponiveis = await prisma.course.findMany({
    where: { active: true, ...(school ? { school } : {}) },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  const scopeIds = cursoId
    ? [cursoId]
    : cursosDisponiveis.map((c) => c.id);

  const [rankingStudents, publishedItems] = await Promise.all([
    prisma.student.findMany({
      where: { status: "ATIVO", courseId: { in: scopeIds } },
      include: { course: true, platoon: true },
    }),
    prisma.disciplinaryBookItem.findMany({
      where: {
        disciplinaryBook: { status: "PUBLICADO" },
        courseId: { in: scopeIds },
      },
      include: {
        communication: { include: { type: { select: { scoreNature: true } } } },
      },
    }),
  ]);

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
    .sort((a, b) => b.nota - a.nota);

  const cursoSelecionado = cursosDisponiveis.find((c) => c.id === cursoId);
  const labelEscopo = school === "ESFAP" ? "EsFAP" : school === "ESFO" ? "EsFO" : "Todos os cursos";
  const escopo = cursoSelecionado?.name ?? labelEscopo;

  return (
    <PrintLayout title={`Ranking de Conduta — ${escopo}`}>
      <div className="print-section">
        <h2>Ranking de Conduta</h2>
        <p style={{ fontSize: "9pt", color: "#555", marginBottom: "12px" }}>
          {escopo} · {ranking.length} aluno(s) · notas baseadas nos cadernos publicados
        </p>
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
              <th>Pelotão</th>
              <th style={{ textAlign: "center" }}>Faixa</th>
              <th style={{ textAlign: "right" }}>Nota</th>
            </tr>
          </thead>
          <tbody>
            {ranking.map((a, idx) => {
              const faixa = faixaNota(a.nota);
              return (
                <tr key={a.warName + a.courseNumber}>
                  <td style={{ textAlign: "center", fontWeight: "bold", color: "#6b7280" }}>{idx + 1}º</td>
                  <td style={{ textAlign: "center", fontFamily: "monospace" }}>{a.courseNumber}</td>
                  <td style={{ fontWeight: "bold" }}>{a.warName}</td>
                  <td style={{ fontSize: "8pt", color: "#374151" }}>{a.fullName}</td>
                  <td style={{ fontSize: "8pt", color: "#6b7280" }}>{a.platoonName ?? "—"}</td>
                  <td style={{ textAlign: "center", fontSize: "8pt", fontWeight: "bold", color: faixa.cor }}>
                    {faixa.label}
                  </td>
                  <td style={{ textAlign: "right", fontWeight: "bold", fontSize: "10pt",
                               color: a.nota >= 7 ? "#166534" : a.nota >= 5 ? "#1d4ed8" : "#b91c1c" }}>
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
