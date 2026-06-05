import { prisma } from "@/lib/db";
import { verifySession } from "@/lib/dal";
import TrocarSenhaForm from "./_components/TrocarSenhaForm";

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
  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user) return null;

  const mustChange = sp.mustChange === "1" || user.mustChangePassword;

  const campos = [
    { label: "Nome completo",   value: user.fullName },
    { label: "Nome de guerra",  value: user.warName },
    { label: "Posto/Graduação", value: user.rank },
    { label: "CPF",             value: user.cpf ?? "Não informado" },
    { label: "RG",              value: user.rg },
    { label: "Nº Funcional",    value: user.functionalNumber },
    { label: "E-mail",          value: user.email },
    { label: "Função",          value: ROLE_LABELS[user.role] ?? user.role },
    { label: "Situação",        value: user.active ? "Ativo" : "Inativo" },
  ];

  return (
    <div className="p-6 max-w-2xl">
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
    </div>
  );
}
