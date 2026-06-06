import { prisma } from "@/lib/db";
import { verifyRole } from "@/lib/dal";
import Link from "next/link";
import ExcluirUsuarioBtn from "./_components/ExcluirUsuarioBtn";

const ROLES: Record<string, string> = {
  ADMINISTRADOR:           "Administrador",
  COMANDANTE_APM:          "Comandante da APM/ES",
  SUBCOMANDANTE_APM:       "Subcomandante da APM/ES",
  CHEFE_DIVISAO_ACADEMICA: "Chefe da Divisão Acadêmica",
  COMANDANTE_ESFAP:        "Comandante da EsFAP",
  COMANDANTE_ESFO:         "Comandante da EsFO",
  SUBCOMANDANTE_ESFAP:     "Subcomandante da EsFAP",
  SUBCOMANDANTE_ESFO:      "Subcomandante da EsFO",
  OFICIAL_ESFAP:           "Oficial da EsFAP",
  OFICIAL_ESFO:            "Oficial da EsFO",
  CHEFE_CURSO:             "Chefe de Curso",
  PROTOCOLO:               "Setor de Protocolo",
  ALUNO:                   "Aluno",
};

export default async function UsuariosPage() {
  const session = await verifyRole(
    "ADMINISTRADOR", "COMANDANTE_ESFAP", "COMANDANTE_ESFO",
    "SUBCOMANDANTE_ESFAP", "SUBCOMANDANTE_ESFO", "OFICIAL_ESFAP", "OFICIAL_ESFO",
  );
  // Alunos ficam apenas na aba Alunos — usuários são apenas o efetivo formado
  const usuarios = await prisma.user.findMany({ where: { role: { not: "ALUNO" } }, orderBy: { fullName: "asc" } });

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Usuários</h1>
          <p className="text-sm text-gray-500">{usuarios.length} usuário(s) cadastrado(s)</p>
        </div>
        <Link
          href="/usuarios/novo"
          className="bg-[#1e3a5f] text-white px-4 py-2 rounded-lg text-sm hover:bg-[#16304f] transition-colors"
        >
          + Novo Usuário
        </Link>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-700">Nome</th>
              <th className="text-left px-4 py-3 font-medium text-gray-700">Nome de Guerra</th>
              <th className="text-left px-4 py-3 font-medium text-gray-700">Posto/Grad.</th>
              <th className="text-left px-4 py-3 font-medium text-gray-700">Função</th>
              <th className="text-left px-4 py-3 font-medium text-gray-700">Escola</th>
              <th className="text-left px-4 py-3 font-medium text-gray-700">Situação</th>
              <th className="text-left px-4 py-3 font-medium text-gray-700">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {usuarios.map((u) => (
              <tr key={u.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-900">{u.fullName}</td>
                <td className="px-4 py-3 text-gray-600">{u.warName}</td>
                <td className="px-4 py-3 text-gray-600">{u.rank}</td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                    {ROLES[u.role] ?? u.role}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
                    {u.escola === "ESFAP" ? "EsFAP" : u.escola === "ESFO" ? "EsFO" : "Todas"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${u.active ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
                    {u.active ? "Ativo" : "Inativo"}
                  </span>
                </td>
                <td className="px-4 py-3 flex gap-4">
                  <Link href={`/usuarios/${u.id}/editar`} className="text-[#1e3a5f] hover:underline text-xs">
                    Editar
                  </Link>
                  <ExcluirUsuarioBtn
                    id={u.id}
                    canDelete={session.role === "ADMINISTRADOR" || u.role !== "ADMINISTRADOR"}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
