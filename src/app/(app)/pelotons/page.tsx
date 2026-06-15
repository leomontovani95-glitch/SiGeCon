import { prisma } from "@/lib/db";
import { verifySession } from "@/lib/dal";
import { platoonOrder } from "@/lib/utils";
import Link from "next/link";

export default async function PelotonsPage() {
  const session = await verifySession();
  const canManage = ["ADMINISTRADOR", "PROTOCOLO"].includes(session.role);
  const pelotoes = (await prisma.platoon.findMany({
    include: { course: true, _count: { select: { students: true } } },
  })).sort(
    (a, b) =>
      a.course.name.localeCompare(b.course.name) ||
      platoonOrder(a.name) - platoonOrder(b.name),
  );

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pelotões</h1>
          <p className="text-sm text-gray-500">{pelotoes.length} pelotão(ões) cadastrado(s)</p>
        </div>
        {canManage && (
          <Link href="/pelotons/novo" className="bg-[#1e3a5f] text-white px-4 py-2 rounded-lg text-sm hover:bg-[#16304f] transition-colors">
            + Novo Pelotão
          </Link>
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-700">Pelotão</th>
              <th className="text-left px-4 py-3 font-medium text-gray-700">Curso</th>
              <th className="text-left px-4 py-3 font-medium text-gray-700">Alunos</th>
              <th className="text-left px-4 py-3 font-medium text-gray-700">Situação</th>
              {canManage && <th className="text-left px-4 py-3 font-medium text-gray-700">Ações</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {pelotoes.map((p) => (
              <tr key={p.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-900">{p.name}</td>
                <td className="px-4 py-3 text-gray-600">{p.course.name}</td>
                <td className="px-4 py-3 text-gray-600">{p._count.students}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${p.active ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
                    {p.active ? "Ativo" : "Inativo"}
                  </span>
                </td>
                {canManage && (
                  <td className="px-4 py-3">
                    <Link href={`/pelotons/${p.id}/editar`} className="text-xs text-[#1e3a5f] hover:underline">Editar</Link>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
