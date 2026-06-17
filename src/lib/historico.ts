import "server-only";
import { prisma } from "@/lib/db";
import { calcularNotaPublicada } from "@/lib/score";
import { formatCadernoNumero } from "@/lib/utils";

// Dados consolidados do histórico de conduta de um aluno (matrícula/curso).
// Fonte única usada tanto pela página imprimível (PDF) quanto pela aba
// "Histórico" do Meu Perfil, evitando divergência de cálculo entre as duas.
export async function getHistoricoAluno(id: string) {
  const [aluno, pubItems] = await Promise.all([
    prisma.student.findUnique({
      where: { id },
      include: {
        course: true,
        platoon: true,
        communications: {
          include: { type: true, decisions: { include: { authority: true } } },
          orderBy: { factDate: "asc" },
        },
      },
    }),
    prisma.disciplinaryBookItem.findMany({
      where: { studentId: id, disciplinaryBook: { status: "PUBLICADO" } },
      include: {
        communication: { include: { type: { select: { scoreNature: true } } } },
        disciplinaryBook: { select: { id: true, number: true, year: true, publicationDate: true, course: { select: { name: true } } } },
      },
      orderBy: { disciplinaryBook: { publicationDate: "asc" } },
    }),
  ]);
  if (!aluno) return null;

  const nota = calcularNotaPublicada(pubItems);
  const desfavoravel = pubItems.filter((i) => i.communication.type.scoreNature === "DESFAVORAVEL").reduce((s, i) => s + Math.abs(i.score ?? 0), 0);
  const favoravel    = pubItems.filter((i) => i.communication.type.scoreNature === "FAVORAVEL").reduce((s, i) => s + Math.abs(i.score ?? 0), 0);

  // Contagens por tipo de comunicação
  const ct = aluno.communications.reduce((acc, c) => { acc[c.type.name] = (acc[c.type.name] ?? 0) + 1; return acc; }, {} as Record<string, number>);
  const resumo = [
    { label: "Total",         value: aluno.communications.length,                color: "#1e3a5f" },
    { label: "Publicados",    value: pubItems.length,                             color: "#374151" },
    { label: "CPI 0/1",       value: (ct["CPI 0"] ?? 0) + (ct["CPI 1"] ?? 0),     color: "#b45309" },
    { label: "CPI 2",         value: ct["CPI 2"] ?? 0,                            color: "#b91c1c" },
    { label: "CPI 3",         value: ct["CPI 3"] ?? 0,                            color: "#7f1d1d" },
    { label: "TD Leve",       value: ct["TD Leve"] ?? 0,                          color: "#b45309" },
    { label: "TD Média",      value: ct["TD Média"] ?? 0,                         color: "#b91c1c" },
    { label: "TD Grave",      value: ct["TD Grave"] ?? 0,                         color: "#7f1d1d" },
    { label: "TAC",           value: ct["TAC"] ?? 0,                              color: "#7f1d1d" },
    { label: "Arq.",          value: ct["Arquivamento"] ?? 0,                     color: "#6b7280" },
    { label: "Ref. Elogiosa", value: ct["Referência Elogiosa"] ?? 0,             color: "#15803d" },
    { label: "Elogio BI",     value: ct["Elogio publicado em BI"] ?? 0,          color: "#15803d" },
  ];

  // Evolução da nota por caderno publicado. Ordena por (data de publicação,
  // número) para desempate estável quando cadernos de cursos diferentes são
  // publicados na mesma data.
  const cadernosOrdenados = Array.from(
    new Map(
      pubItems
        .filter((i) => i.disciplinaryBook.publicationDate)
        .map((i) => [i.disciplinaryBook.id, i.disciplinaryBook])
    ).values()
  ).sort((a, b) => {
    const dt = new Date(a.publicationDate!).getTime() - new Date(b.publicationDate!).getTime();
    return dt !== 0 ? dt : a.number - b.number;
  });

  // Acumula por pertencimento ao caderno (e não por comparação de data), para
  // que cadernos publicados no mesmo dia não somem os itens um do outro.
  const evolucao: { label: string; date: Date; nota: number }[] = [];
  const idsAteAqui = new Set<string>();
  for (const caderno of cadernosOrdenados) {
    idsAteAqui.add(caderno.id);
    const itensAteCaderno = pubItems.filter((i) => idsAteAqui.has(i.disciplinaryBook.id));
    evolucao.push({
      label: formatCadernoNumero(caderno),
      date: new Date(caderno.publicationDate!),
      nota: calcularNotaPublicada(itensAteCaderno),
    });
  }

  return { aluno, pubItems, nota, desfavoravel, favoravel, resumo, evolucao };
}

export type HistoricoAluno = NonNullable<Awaited<ReturnType<typeof getHistoricoAluno>>>;

// Todas as matrículas da mesma pessoa (mesmo RG) — ex.: ascensão de curso.
// A matrícula "atual" é a que carrega o login vinculado (userId); na falta,
// a mais recente. As demais são históricos anteriores.
export async function getMatriculas(rg: string) {
  const records = await prisma.student.findMany({
    where: { rg },
    select: {
      id: true,
      userId: true,
      courseNumber: true,
      createdAt: true,
      course: { select: { name: true, active: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  const current = records.find((r) => r.userId) ?? records[0];
  return { records, currentId: current?.id ?? null };
}

export const STATUS_COMUNICACAO_LABELS: Record<string, string> = {
  REGISTRADA: "Registrada",
  AGUARDANDO_CIENCIA: "Ag. Ciência/Defesa",
  AGUARDANDO_DEFESA: "Ag. Ciência/Defesa",
  JUSTIFICATIVA_APRESENTADA: "Defesa Apresentada",
  PRAZO_EXPIRADO: "Prazo Expirado",
  AGUARDANDO_PARECER: "Ag. Parecer",
  AGUARDANDO_DECISAO: "Ag. Decisão",
  DECIDIDA: "Decidida",
  ARQUIVADA: "Arquivada",
  PUBLICADA_CADERNO: "Pub. Caderno",
  FINALIZADA: "Finalizada",
};
