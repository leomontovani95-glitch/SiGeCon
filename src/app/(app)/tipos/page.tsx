import { prisma } from "@/lib/db";
import { verifyRole } from "@/lib/dal";
import Link from "next/link";

export default async function TiposPage() {
  await verifyRole("ADMINISTRADOR", "COMANDANTE_ESFAP", "COMANDANTE_ESFO", "CHEFE_DIVISAO_ACADEMICA", "SUBCOMANDANTE_ESFAP", "SUBCOMANDANTE_ESFO", "OFICIAL_ESFAP", "OFICIAL_ESFO");
  const tipos = await prisma.communicationType.findMany({ orderBy: { name: "asc" } });
  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tipos de Comunicação</h1>
          <p className="text-sm text-gray-500">Configuração das pontuações (NPCE 2025)</p>
        </div>
        <Link href="/tipos/novo" className="bg-[#1e3a5f] text-white px-4 py-2 rounded-lg text-sm hover:bg-[#16304f] transition-colors">+ Novo Tipo</Link>
      </div>
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-700">Nome</th>
              <th className="text-left px-4 py-3 font-medium text-gray-700">Pontuação</th>
              <th className="text-left px-4 py-3 font-medium text-gray-700">Natureza</th>
              <th className="text-left px-4 py-3 font-medium text-gray-700">Ativo</th>
              <th className="text-left px-4 py-3 font-medium text-gray-700">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {tipos.map((t) => (
              <tr key={t.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-900">{t.name}</td>
                <td className="px-4 py-3 text-gray-600">{t.score.toFixed(1)}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${t.scoreNature === "DESFAVORAVEL" ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}>
                    {t.scoreNature === "DESFAVORAVEL" ? "Desfavorável" : "Favorável"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${t.active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                    {t.active ? "Sim" : "Não"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <Link href={`/tipos/${t.id}/editar`} className="text-xs text-[#1e3a5f] hover:underline">Editar</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
