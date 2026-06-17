import { prisma } from "@/lib/db";
import { verifySession, getSchoolFilter, VIEWERS_APM } from "@/lib/dal";
import { redirect } from "next/navigation";
import Link from "next/link";

function rankAluno(courseName: string): string {
  const u = courseName.toUpperCase();
  if (u.startsWith("CFO")) return "AL OF PM";
  if (u.startsWith("CFSD")) return "AL SD PM";
  if (u.startsWith("CHS")) return "AL SGT PM";
  return "AL PM";
}

const SCHOOL_LABEL: Record<string, string> = { ESFAP: "EsFAP", ESFO: "EsFO" };

export default async function AlunosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const session = await verifySession();
  if (session.role === "ALUNO") redirect("/acesso-negado");

  const school = getSchoolFilter(session.role, session.escola);

  const sp = await searchParams;
  const situacao = sp.situacao === "inativos" ? "inativos" : "ativos";
  const ativo = situacao === "ativos";

  // Aba "Inativos" reúne os cursos inativados; ao clicar no card chega-se a todos
  // os alunos do curso. Reativar o curso traz tudo de volta à aba "Ativos".
  const courses = await prisma.course.findMany({
    where: { active: ativo, ...(school ? { school } : {}) },
    orderBy: [{ name: "asc" }],
    include: { _count: { select: { students: true } } },
  });

  const total = courses.reduce((s, c) => s + c._count.students, 0);
  const canManage = session.role !== "ALUNO" && !(VIEWERS_APM as string[]).includes(session.role);

  const tabs = [
    { key: "ativos", label: "Cursos ativos" },
    { key: "inativos", label: "Cursos inativos" },
  ] as const;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Alunos</h1>
          <p className="text-sm text-gray-500">
            {total} aluno{total !== 1 ? "s" : ""} em {courses.length} curso{courses.length !== 1 ? "s" : ""} {ativo ? "ativo" : "inativo"}{courses.length !== 1 ? "s" : ""}
          </p>
        </div>
        {canManage && (
          <Link href="/alunos/novo" className="bg-[#1e3a5f] text-white px-4 py-2 rounded-lg text-sm hover:bg-[#16304f] transition-colors">
            + Novo Aluno
          </Link>
        )}
      </div>

      <div className="flex gap-1 mb-6 border-b border-gray-200">
        {tabs.map((t) => (
          <Link
            key={t.key}
            href={`/alunos?situacao=${t.key}`}
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

      {courses.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400">
          {ativo
            ? <>Nenhum curso ativo encontrado. Crie um curso na aba <strong>Cursos</strong>.</>
            : "Nenhum curso inativo."}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {courses.map((c) => (
            <Link
              key={c.id}
              href={`/alunos/curso/${c.id}`}
              className="bg-white border border-gray-200 rounded-xl p-5 hover:border-[#1e3a5f] hover:shadow-sm transition-all group"
            >
              <div className="flex items-start justify-between mb-3">
                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">
                  {SCHOOL_LABEL[c.school ?? ""] ?? c.school ?? "—"}
                </span>
                <div className="flex items-center gap-2">
                  {!c.active && (
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-red-100 text-red-700">Inativo</span>
                  )}
                  <span className="text-xs text-gray-400">{rankAluno(c.name)}</span>
                </div>
              </div>
              <h2 className="text-base font-bold text-gray-900 group-hover:text-[#1e3a5f] mb-1">{c.name}</h2>
              <p className="text-2xl font-bold text-[#1e3a5f]">{c._count.students}</p>
              <p className="text-xs text-gray-400 mt-0.5">aluno{c._count.students !== 1 ? "s" : ""} cadastrado{c._count.students !== 1 ? "s" : ""}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
