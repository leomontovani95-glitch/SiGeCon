import { prisma } from "@/lib/db";
import { verifyRole, MANUAL_ROLES } from "@/lib/dal";
import Link from "next/link";
import ExcluirRegraBtn from "./_components/ExcluirRegraBtn";

export default async function ManualPage() {
  await verifyRole(...MANUAL_ROLES);
  const regras = await prisma.manualRule.findMany({ orderBy: [{ article: "asc" }, { item: "asc" }, { letter: "asc" }] });

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Manual do Aluno</h1>
          <p className="text-sm text-gray-500">Dispositivos legais (artigos, incisos, alíneas)</p>
        </div>
        <Link href="/manual/novo" className="bg-[#1e3a5f] text-white px-4 py-2 rounded-lg text-sm hover:bg-[#16304f] transition-colors">
          + Novo Dispositivo
        </Link>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-700">Artigo</th>
              <th className="text-left px-4 py-3 font-medium text-gray-700">Inciso</th>
              <th className="text-left px-4 py-3 font-medium text-gray-700">Alínea</th>
              <th className="text-left px-4 py-3 font-medium text-gray-700">Tema</th>
              <th className="text-left px-4 py-3 font-medium text-gray-700">Descrição da Conduta</th>
              <th className="text-left px-4 py-3 font-medium text-gray-700">Tipo</th>
              <th className="text-left px-4 py-3 font-medium text-gray-700">Ativo</th>
              <th className="text-left px-4 py-3 font-medium text-gray-700">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {regras.map((r) => (
              <tr key={r.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-mono text-xs text-gray-700">Art. {r.article}</td>
                <td className="px-4 py-3 font-mono text-xs text-gray-600">{r.item ? `Inc. ${r.item}` : "—"}</td>
                <td className="px-4 py-3 font-mono text-xs text-gray-600">{r.letter ? `Al. ${r.letter}` : "—"}</td>
                <td className="px-4 py-3 text-xs text-gray-500 max-w-[160px] truncate">{r.theme ?? "—"}</td>
                <td className="px-4 py-3 text-gray-700 max-w-xs truncate">{r.description}</td>
                <td className="px-4 py-3 text-gray-600">{r.defaultCommunicationType ?? "—"}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${r.active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                    {r.active ? "Sim" : "Não"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Link href={`/manual/${r.id}/editar`} className="text-xs text-[#1e3a5f] hover:underline">Editar</Link>
                    <ExcluirRegraBtn id={r.id} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
