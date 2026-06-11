import { prisma } from "@/lib/db";
import { verifySession, canManageUserRole, USER_MANAGERS } from "@/lib/dal";
import { notFound } from "next/navigation";
import Link from "next/link";

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
};

const ESCOLA_LABELS: Record<string, string> = {
  ESFAP: "EsFAP",
  ESFO:  "EsFO",
  TODAS: "Todas as escolas",
};

export default async function UsuarioPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await verifySession();
  const { id } = await params;

  const usuario = await prisma.user.findUnique({ where: { id } });
  if (!usuario || usuario.role === "ALUNO") notFound();

  const canEdit = (USER_MANAGERS as string[]).includes(session.role)
    && canManageUserRole(session.role, usuario.role);

  const camposPrincipais = [
    { label: "Nome completo",   value: usuario.fullName,      wide: true },
    { label: "Nome de guerra",  value: usuario.warName },
    { label: "Posto/Graduação", value: usuario.rank },
    { label: "RG",              value: usuario.rg },
    { label: "Nº Funcional",    value: usuario.functionalNumber },
    { label: "Escola",          value: ESCOLA_LABELS[usuario.escola] ?? usuario.escola },
    { label: "Situação",        value: usuario.active ? "Ativo" : "Inativo" },
  ];

  const funcoes = [ROLE_LABELS[usuario.role] ?? usuario.role];
  const extras = (usuario.additionalRoles ?? "").split(",").filter(Boolean);
  for (const r of extras) funcoes.push(ROLE_LABELS[r] ?? r);

  return (
    <div className="p-6 max-w-2xl">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{usuario.warName}</h1>
          <p className="text-sm text-gray-500">{usuario.fullName}</p>
        </div>
        {canEdit && (
          <Link href={`/usuarios/${usuario.id}/editar`} className="btn-secondary text-xs">
            Editar
          </Link>
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-4">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Dados Cadastrais</h2>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
          {camposPrincipais.map(({ label, value, wide }) => (
            <div key={label} className={wide ? "sm:col-span-2" : ""}>
              <dt className="text-xs font-medium text-gray-500">{label}</dt>
              <dd className="mt-0.5 text-sm font-medium text-gray-900">{value ?? "—"}</dd>
            </div>
          ))}
          <div className="sm:col-span-2">
            <dt className="text-xs font-medium text-gray-500">Função(ões)</dt>
            <dd className="mt-0.5 text-sm font-medium text-gray-900">{funcoes.join("/")}</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
