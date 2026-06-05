import { prisma } from "@/lib/db";
import { verifySession, getSchoolFilter } from "@/lib/dal";
import { redirect } from "next/navigation";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import Link from "next/link";
import CriarCadernoBtn from "./_components/CriarCadernoBtn";

const CADERNO_MANAGERS = [
  "ADMINISTRADOR", "PROTOCOLO",
  "COMANDANTE_ESFAP", "COMANDANTE_ESFO", "CHEFE_DIVISAO_ACADEMICA",
];

export default async function CadernoPage() {
  const session = await verifySession();
  if (session.role === "ALUNO") redirect("/acesso-negado");

  const canManage = CADERNO_MANAGERS.includes(session.role);
  const school = getSchoolFilter(session.role, session.escola);

  const [cadernos, pendentesPublicacao] = await Promise.all([
    prisma.disciplinaryBook.findMany({
      orderBy: [{ courseId: "asc" }, { number: "asc" }],
      include: { createdBy: true, publishedBy: true, course: true, _count: { select: { items: true } } },
    }),
    // Conta registros decididos ainda não publicados em caderno (todos, sem filtro de escola)
    prisma.communication.count({ where: { status: "DECIDIDA" } }),
  ]);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Caderno Disciplinar</h1>
          <p className="text-sm text-gray-500">{cadernos.length} edição(ões)</p>
        </div>
        {canManage && <CriarCadernoBtn pendentesCount={pendentesPublicacao} />}
      </div>

      {pendentesPublicacao > 0 && canManage && (
        <div className="mb-5 bg-yellow-50 border border-yellow-200 rounded-xl px-5 py-3 flex items-center gap-3">
          <span className="text-yellow-700 text-sm font-medium">
            {pendentesPublicacao} registro(s) decidido(s) aguardando publicação em caderno.
          </span>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-700">Nº Caderno</th>
              <th className="text-left px-4 py-3 font-medium text-gray-700">Escola</th>
              <th className="text-left px-4 py-3 font-medium text-gray-700">Registros</th>
              <th className="text-left px-4 py-3 font-medium text-gray-700">Status</th>
              <th className="text-left px-4 py-3 font-medium text-gray-700">Publicado em</th>
              <th className="text-left px-4 py-3 font-medium text-gray-700">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {cadernos.map((c) => (
              <tr key={c.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-mono font-bold text-gray-900">
                  {c.course
                    ? `CD Nº ${String(c.number).padStart(2, "0")} — ${c.course.name}`
                    : `CD-${String(c.number).padStart(4, "0")}`}
                </td>
                <td className="px-4 py-3 text-xs text-gray-500">{c.course?.name ?? c.school ?? "—"}</td>
                <td className="px-4 py-3 text-gray-600">{c._count.items}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${c.status === "PUBLICADO" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}>
                    {c.status === "PUBLICADO" ? "Publicado" : "Rascunho"}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-500">
                  {c.publicationDate ? format(new Date(c.publicationDate), "dd/MM/yyyy", { locale: ptBR }) : "—"}
                </td>
                <td className="px-4 py-3 flex gap-3">
                  <Link href={`/caderno/${c.id}`} className="text-xs text-[#1e3a5f] hover:underline">Ver</Link>
                  {canManage && c.status !== "PUBLICADO" && (!school || c.school === school || c.school === null) && (
                    <Link href={`/caderno/${c.id}/editar`} className="text-xs text-gray-500 hover:underline">Revisar / Publicar</Link>
                  )}
                </td>
              </tr>
            ))}
            {cadernos.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">Nenhum caderno criado ainda.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
