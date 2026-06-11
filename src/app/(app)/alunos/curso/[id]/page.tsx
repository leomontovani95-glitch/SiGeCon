import { prisma } from "@/lib/db";
import { verifySession, getSchoolFilter, VIEWERS_APM } from "@/lib/dal";
import { redirect, notFound } from "next/navigation";
import { calcularNotaPublicada, faixaNota } from "@/lib/score";
import { abreviarPelotao } from "@/lib/utils";
import Link from "next/link";
import { Suspense } from "react";
import SortableHeader from "../../_components/SortableHeader";
import Pagination from "../../_components/Pagination";

const PAGE_SIZE = 50;

const STATUS: Record<string, string> = {
  ATIVO: "Ativo", DESLIGADO: "Desligado", TRANSFERIDO: "Transferido",
  FORMADO: "Formado", ARQUIVADO: "Arquivado",
};

function rankAluno(courseName: string): string {
  const u = courseName.toUpperCase();
  if (u.startsWith("CFO")) return "AL OF PM";
  if (u.startsWith("CFSD")) return "AL SD PM";
  if (u.startsWith("CHS")) return "AL SGT PM";
  return "AL PM";
}

type SortDir = "asc" | "desc";
const JS_SORT = ["nota", "courseNumber"];

function buildOrderBy(sortBy: string, dir: SortDir) {
  switch (sortBy) {
    case "platoon": return { platoon: { name: dir } };
    case "status":  return { status: dir };
    default:        return { warName: dir };
  }
}

export default async function CursoAlunosPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string>>;
}) {
  const session = await verifySession();
  if (session.role === "ALUNO") redirect("/acesso-negado");
  const canManage = session.role !== "ALUNO" && !(VIEWERS_APM as string[]).includes(session.role);

  const { id } = await params;
  const sp = await searchParams;
  const busca        = sp.busca   ?? "";
  const statusFiltro = sp.status  ?? "";
  const sortBy  = sp.sortBy ?? "courseNumber";
  const sortDir = (sp.sortDir === "desc" ? "desc" : "asc") as SortDir;
  const page    = Math.max(1, parseInt(sp.page ?? "1") || 1);

  const school = getSchoolFilter(session.role, session.escola);
  const course = await prisma.course.findUnique({ where: { id } });
  if (!course) notFound();
  if (school && course.school !== school) notFound();

  const where = {
    courseId: id,
    ...(statusFiltro ? { status: statusFiltro } : {}),
    ...(busca ? {
      OR: [
        { fullName: { contains: busca } },
        { warName: { contains: busca } },
        { rg: { contains: busca } },
        { courseNumber: { contains: busca } },
      ],
    } : {}),
  };

  // Busca alunos e itens de cadernos publicados em paralelo
  const [allStudents, publishedItems] = await Promise.all([
    prisma.student.findMany({
      where,
      orderBy: JS_SORT.includes(sortBy) ? { warName: "asc" } : buildOrderBy(sortBy, sortDir),
      include: { platoon: true },
    }),
    prisma.disciplinaryBookItem.findMany({
      where: { courseId: id, disciplinaryBook: { status: "PUBLICADO" } },
      include: { communication: { include: { type: { select: { scoreNature: true } } } } },
    }),
  ]);

  // Agrupa itens publicados por aluno
  const pubPorAluno = new Map<string, typeof publishedItems>();
  for (const item of publishedItems) {
    if (!pubPorAluno.has(item.studentId)) pubPorAluno.set(item.studentId, []);
    pubPorAluno.get(item.studentId)!.push(item);
  }

  // Ordenação numérica/calculada em JS
  const sorted = JS_SORT.includes(sortBy)
    ? [...allStudents].sort((a, b) => {
        const diff = sortBy === "courseNumber"
          ? (parseInt(a.courseNumber, 10) || 0) - (parseInt(b.courseNumber, 10) || 0)
          : calcularNotaPublicada(pubPorAluno.get(a.id) ?? []) - calcularNotaPublicada(pubPorAluno.get(b.id) ?? []);
        return sortDir === "asc" ? diff : -diff;
      })
    : allStudents;

  const total      = sorted.length;
  const totalPages = Math.ceil(total / PAGE_SIZE);
  const safePage   = Math.min(page, totalPages || 1);
  const paginated  = sorted.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const sharedProps = { currentSort: sortBy, currentDir: sortDir };

  return (
    <div className="p-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
        <Link href="/alunos" className="hover:text-[#1e3a5f] transition-colors">Alunos</Link>
        <span>›</span>
        <span className="text-gray-900 font-medium">{course.name}</span>
      </div>

      {/* Cabeçalho */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{course.name}</h1>
          <p className="text-sm text-gray-500">
            {total} aluno{total !== 1 ? "s" : ""}
            {totalPages > 1 && ` · página ${safePage} de ${totalPages}`}
          </p>
        </div>
        {canManage && (
          <Link href="/alunos/novo" className="bg-[#1e3a5f] text-white px-4 py-2 rounded-lg text-sm hover:bg-[#16304f] transition-colors">
            + Novo Aluno
          </Link>
        )}
      </div>

      {/* Busca — preserva sort e reseta página */}
      <form method="GET" className="mb-5 flex flex-wrap gap-2">
        <input
          name="busca"
          defaultValue={busca}
          placeholder="Buscar por nome, nome de guerra, RG ou nº de curso..."
          className="w-full max-w-md input"
        />
        <select name="status" defaultValue={statusFiltro} className="input text-sm">
          <option value="">Todas as situações</option>
          <option value="ATIVO">Ativo</option>
          <option value="DESLIGADO">Desligado</option>
          <option value="TRANSFERIDO">Transferido</option>
          <option value="FORMADO">Formado</option>
          <option value="ARQUIVADO">Arquivado</option>
        </select>
        <input type="hidden" name="sortBy"  value={sortBy} />
        <input type="hidden" name="sortDir" value={sortDir} />
        <button type="submit" className="btn-primary px-4">Filtrar</button>
        {(busca || statusFiltro) && (
          <Link href={`/alunos/curso/${id}`} className="btn-secondary px-4 flex items-center">
            Limpar filtros
          </Link>
        )}
      </form>

      {/* Tabela */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <Suspense fallback={null}>
                <SortableHeader column="warName"      label="Nome de Guerra" {...sharedProps} />
                <SortableHeader column="courseNumber" label="Nº Curso"        {...sharedProps} />
                <SortableHeader column="platoon"      label="Pelotão"         {...sharedProps} />
                <SortableHeader column="nota"         label="Nota"            {...sharedProps} />
                <SortableHeader column="status"       label="Situação"        {...sharedProps} />
              </Suspense>
              <th className="text-left px-4 py-3 font-medium text-gray-700">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {paginated.map((a) => {
              const nota  = calcularNotaPublicada(pubPorAluno.get(a.id) ?? []);
              const faixa = faixaNota(nota);
              return (
                <tr key={a.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">
                    <span className="text-xs text-gray-400 font-normal mr-1">{rankAluno(course.name)}</span>
                    <Link href={`/alunos/${a.id}`} className="hover:text-[#1e3a5f] hover:underline">{a.warName}</Link>
                  </td>
                  <td className="px-4 py-3 text-gray-600 font-mono text-xs">{a.courseNumber}</td>
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{abreviarPelotao(a.platoon?.name)}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${faixa.tailwind}`}>
                      {nota.toFixed(2)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs text-gray-600">{STATUS[a.status] ?? a.status}</span>
                  </td>
                  <td className="px-4 py-3 flex gap-3">
                    <Link href={`/alunos/${a.id}`} className="text-xs text-[#1e3a5f] hover:underline">Ver</Link>
                    {canManage && (
                      <Link href={`/alunos/${a.id}/editar`} className="text-xs text-gray-500 hover:underline">Editar</Link>
                    )}
                  </td>
                </tr>
              );
            })}
            {paginated.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-gray-400">
                  Nenhum aluno encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Paginação */}
        <Suspense fallback={null}>
          <Pagination page={safePage} totalPages={totalPages} />
        </Suspense>
      </div>
    </div>
  );
}
