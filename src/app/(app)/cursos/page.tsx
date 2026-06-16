import { prisma } from "@/lib/db";
import { verifySession } from "@/lib/dal";
import Link from "next/link";
import ExcluirCursoBtn from "./_components/ExcluirCursoBtn";

export default async function CursosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const session = await verifySession();
  const canManage = ["ADMINISTRADOR", "PROTOCOLO", "COMANDANTE_ESFAP", "COMANDANTE_ESFO", "CHEFE_DIVISAO_ACADEMICA", "SUBCOMANDANTE_ESFAP", "SUBCOMANDANTE_ESFO", "OFICIAL_ESFAP", "OFICIAL_ESFO"].includes(session.role);

  const sp = await searchParams;
  const situacao = sp.situacao === "inativos" ? "inativos" : "ativos";
  const ativo = situacao === "ativos";

  const cursos = await prisma.course.findMany({
    where: { active: ativo },
    orderBy: { name: "asc" },
    include: { _count: { select: { students: true, platoons: true, communications: true } } },
  });

  const tabs = [
    { key: "ativos", label: "Ativos" },
    { key: "inativos", label: "Inativos" },
  ] as const;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Cursos</h1>
          <p className="text-sm text-gray-500">{cursos.length} curso(s) {ativo ? "ativo(s)" : "inativo(s)"}</p>
        </div>
        {canManage && (
          <Link href="/cursos/novo" className="bg-[#1e3a5f] text-white px-4 py-2 rounded-lg text-sm hover:bg-[#16304f] transition-colors">
            + Novo Curso
          </Link>
        )}
      </div>

      <div className="flex gap-1 mb-6 border-b border-gray-200">
        {tabs.map((t) => (
          <Link
            key={t.key}
            href={`/cursos?situacao=${t.key}`}
            className={`px-4 py-2 text-sm font-medium -mb-px border-b-2 transition-colors ${
              situacao === t.key
                ? "border-[#1e3a5f] text-[#1e3a5f]"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {cursos.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400">
          Nenhum curso {ativo ? "ativo" : "inativo"} encontrado.
        </div>
      ) : (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {cursos.map((c) => (
          <div key={c.id} className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="font-semibold text-gray-900">{c.name}</h3>
                <p className="text-xs text-gray-500">{c.acronym}</p>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full ${c.active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                {c.active ? "Ativo" : "Inativo"}
              </span>
            </div>
            <div className="text-sm text-gray-600 space-y-1">
              <p>{c._count.platoons} pelotão(ões)</p>
              <p>{c._count.students} aluno(s)</p>
            </div>
            {canManage && (
              <div className="mt-4 pt-3 border-t border-gray-100 flex gap-4">
                <Link href={`/cursos/${c.id}/editar`} className="text-xs text-[#1e3a5f] hover:underline">
                  Editar
                </Link>
                <ExcluirCursoBtn id={c.id} hasData={c._count.students > 0 || c._count.communications > 0} />
              </div>
            )}
          </div>
        ))}
      </div>
      )}
    </div>
  );
}
