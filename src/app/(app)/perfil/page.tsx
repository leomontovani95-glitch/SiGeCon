import { prisma } from "@/lib/db";
import { verifySession } from "@/lib/dal";
import Link from "next/link";
import { getHistoricoAluno, getMatriculas } from "@/lib/historico";
import HistoricosBox, { type MatriculaEntry } from "@/components/HistoricosBox";
import TrocarSenhaForm from "./_components/TrocarSenhaForm";
import HistoricoView from "./_components/HistoricoView";

const ROLE_LABELS: Record<string, string> = {
  ADMINISTRADOR:           "Administrador",
  COMANDANTE_APM:          "Comandante da APM/ES",
  SUBCOMANDANTE_APM:       "Subcomandante da APM/ES",
  COMANDANTE_ESFAP:        "Comandante da EsFAP",
  COMANDANTE_ESFO:         "Comandante da EsFO",
  CHEFE_DIVISAO_ACADEMICA: "Chefe da Divisão Acadêmica",
  SUBCOMANDANTE_ESFAP:     "Subcomandante da EsFAP",
  SUBCOMANDANTE_ESFO:      "Subcomandante da EsFO",
  OFICIAL_ESFAP:           "Oficial da EsFAP",
  OFICIAL_ESFO:            "Oficial da EsFO",
  CHEFE_CURSO:             "Chefe de Curso",
  PROTOCOLO:               "Setor de Protocolo",
  ALUNO:                   "Aluno",
};

export default async function PerfilPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const session = await verifySession();
  const sp = await searchParams;
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    include: { student: { include: { course: true } } },
  });
  if (!user) return null;

  const isAluno = user.role === "ALUNO" && !!user.student;
  const mustChange = sp.mustChange === "1" || user.mustChangePassword;
  // Troca de senha obrigatória prende o aluno na aba Informações até resolver.
  const aba = isAluno && !mustChange && sp.aba === "historico" ? "historico" : "informacoes";

  // Matrículas da mesma pessoa (mesmo RG) — atual + cursos anteriores (ascensão).
  // A matrícula atual é, por definição, a vinculada ao login (user.student).
  const matriculas = isAluno ? (await getMatriculas(user.rg)).records : [];
  const currentId = user.student?.id ?? null;

  // Histórico selecionado via ?hist=; valida que pertence à mesma pessoa (mesmo
  // RG) para um aluno não conseguir abrir histórico de outro pelo parâmetro.
  const selectedId =
    aba === "historico" && matriculas.some((m) => m.id === sp.hist)
      ? sp.hist
      : currentId;

  const historico = aba === "historico" && selectedId ? await getHistoricoAluno(selectedId) : null;

  const matriculaEntries: MatriculaEntry[] = matriculas.map((m) => ({
    id: m.id,
    courseName: m.course.name,
    courseNumber: m.courseNumber,
    courseActive: m.course.active,
    isCurrent: m.id === currentId,
    selected: m.id === selectedId,
    viewHref: `/perfil?aba=historico&hist=${m.id}`,
    pdfHref: `/alunos/${m.id}/historico/imprimir`,
  }));

  const campos = [
    { label: "Nome completo",   value: user.fullName },
    { label: "Nome de guerra",  value: user.warName },
    { label: "Posto/Graduação", value: user.rank },
    { label: "RG",              value: user.rg },
    { label: "Nº Funcional",    value: user.functionalNumber },
    {
      label: "Função",
      value: [user.role, ...(user.additionalRoles ?? "").split(",").map((r) => r.trim()).filter(Boolean)]
        .map((r) => ROLE_LABELS[r] ?? r)
        .join("/"),
    },
    ...(user.role === "ALUNO"
      ? [{ label: "Curso", value: user.student?.course?.name ?? "—" }]
      : []
    ),
    { label: "Situação",        value: user.active ? "Ativo" : "Inativo" },
  ];

  const tabs = [
    { key: "informacoes", label: "Informações" },
    { key: "historico", label: "Histórico" },
  ] as const;

  return (
    <div className={`p-6 ${aba === "historico" ? "max-w-5xl" : "max-w-2xl"}`}>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Meu Perfil</h1>

      {mustChange && (
        <div className="mb-6 bg-amber-50 border border-amber-300 rounded-xl px-5 py-4 flex items-start gap-3">
          <span className="text-amber-500 text-xl mt-0.5">⚠️</span>
          <div>
            <p className="font-semibold text-amber-800">Troca de senha obrigatória</p>
            <p className="text-sm text-amber-700 mt-0.5">
              Este é o seu primeiro acesso. Por segurança, defina uma senha pessoal antes de usar o sistema.
              Após alterar a senha, o acesso será liberado normalmente.
            </p>
          </div>
        </div>
      )}

      {/* Abas (apenas para alunos, que possuem histórico de conduta) */}
      {isAluno && !mustChange && (
        <div className="flex gap-1 mb-6 border-b border-gray-200">
          {tabs.map((t) => (
            <Link
              key={t.key}
              href={`/perfil?aba=${t.key}`}
              className={`px-4 py-2 text-sm font-medium -mb-px border-b-2 transition-colors ${
                aba === t.key
                  ? "border-[#1e3a5f] text-[#1e3a5f]"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {t.label}
            </Link>
          ))}
        </div>
      )}

      {aba === "historico" && historico ? (
        <>
          <HistoricoView
            historico={historico}
            studentId={selectedId!}
            isCurrent={selectedId === currentId}
            adaptacao={sp.adaptacao === "sim" || sp.adaptacao === "nao" ? sp.adaptacao : ""}
          />
          {/* Seleção de históricos (atual + anteriores) no rodapé */}
          <HistoricosBox entries={matriculaEntries} />
        </>
      ) : (
        <>
          <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Dados cadastrais</h2>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
              {campos.map(({ label, value }) => (
                <div key={label}>
                  <dt className="text-xs font-medium text-gray-500">{label}</dt>
                  <dd className="mt-0.5 text-sm font-medium text-gray-900">{value ?? "—"}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Alterar senha</h2>
            <TrocarSenhaForm />
          </div>
        </>
      )}
    </div>
  );
}
