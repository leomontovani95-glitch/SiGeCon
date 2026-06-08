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
  "SUBCOMANDANTE_ESFAP", "SUBCOMANDANTE_ESFO", "OFICIAL_ESFAP", "OFICIAL_ESFO",
];

export default async function CadernoPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const session = await verifySession();
  if (session.role === "ALUNO") redirect("/acesso-negado");

  const sp = await searchParams;
  const cursoId = sp.cursoId ?? "";

  const canManage = CADERNO_MANAGERS.includes(session.role);
  const school = getSchoolFilter(session.role, session.escola);

  // Cursos disponíveis para este usuário (filtra por escola)
  const cursosDisponiveis = await prisma.course.findMany({
    where: { active: true, ...(school ? { school } : {}) },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  // Filtro de cadernos: por curso selecionado OU por escola
  const cadernoWhere = cursoId
    ? { courseId: cursoId }
    : school
      ? { course: { school } }
      : {};

  const [cadernos, pendentesPublicacao, naoIncluidos] = await Promise.all([
    prisma.disciplinaryBook.findMany({
      where: cadernoWhere,
      orderBy: [{ courseId: "asc" }, { number: "asc" }],
      include: { createdBy: true, publishedBy: true, course: true, _count: { select: { items: true } } },
    }),
    prisma.communication.count({
      where: {
        status: "DECIDIDA",
        disciplinaryBookItems: { none: {} },
        ...(cursoId ? { courseId: cursoId } : school ? { course: { school } } : {}),
      },
    }),
    // Registros com decisão fora de qualquer caderno rascunho (removidos manualmente)
    prisma.communication.findMany({
      where: {
        status: "DECIDIDA",
        disciplinaryBookItems: { none: { disciplinaryBook: { status: "RASCUNHO" } } },
        ...(cursoId ? { courseId: cursoId } : school ? { course: { school } } : {}),
      },
      include: { student: { include: { course: true } }, type: true, decisions: true },
      orderBy: { updatedAt: "desc" },
    }),
  ]);

  const cursoSelecionado = cursosDisponiveis.find((c) => c.id === cursoId);
  const labelEscopo = school === "ESFAP" ? "Todos da EsFAP"
    : school === "ESFO" ? "Todos da EsFO"
    : "Todos os cursos";

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Caderno Disciplinar</h1>
          <p className="text-sm text-gray-500">
            {cursoSelecionado ? cursoSelecionado.name : labelEscopo}
            {" · "}{cadernos.length} edição(ões)
          </p>
        </div>
        {canManage && <CriarCadernoBtn pendentesCount={pendentesPublicacao} />}
      </div>

      {/* Seletor de cursos */}
      {cursosDisponiveis.length > 1 && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-5">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Filtrar por curso</p>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/caderno"
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                !cursoId ? "bg-[#1e3a5f] text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              {labelEscopo}
            </Link>
            {cursosDisponiveis.map((curso) => (
              <Link
                key={curso.id}
                href={`/caderno?cursoId=${curso.id}`}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  cursoId === curso.id ? "bg-[#1e3a5f] text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                {curso.name}
              </Link>
            ))}
          </div>
        </div>
      )}

      {pendentesPublicacao > 0 && canManage && (
        <div className="mb-5 bg-yellow-50 border border-yellow-200 rounded-xl px-5 py-3 flex items-center gap-3">
          <span className="text-yellow-700 text-sm font-medium">
            {pendentesPublicacao} registro(s) decidido(s) aguardando publicação em caderno
            {cursoSelecionado ? ` — ${cursoSelecionado.name}` : ""}.
          </span>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-700">Nº Caderno</th>
              <th className="text-left px-4 py-3 font-medium text-gray-700">Curso</th>
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
                  <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${
                    c.status === "PUBLICADO" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"
                  }`}>
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
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                  {cursoSelecionado
                    ? `Nenhum caderno criado para ${cursoSelecionado.name}.`
                    : "Nenhum caderno criado ainda."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Registros ainda não incluídos em nenhum rascunho */}
      {naoIncluidos.length > 0 && (
        <div className="mt-8">
          <div className="flex items-center gap-3 mb-3">
            <h2 className="text-base font-bold text-yellow-800">
              Registro(s) ainda não incluído(s)
            </h2>
            <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-medium">
              {naoIncluidos.length}
            </span>
          </div>
          <p className="text-xs text-gray-500 mb-3">
            Esses registros têm decisão do Comandante mas não estão em nenhum caderno rascunho.
            Para incluí-los, acesse o caderno rascunho correspondente e clique em &quot;Incluir&quot;.
          </p>
          <div className="bg-white rounded-xl border border-yellow-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-yellow-50 border-b border-yellow-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-700 text-xs">Protocolo</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-700 text-xs">Aluno</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-700 text-xs">Curso</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-700 text-xs">Tipo</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-700 text-xs">Decisão</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {naoIncluidos.map((c) => (
                  <tr key={c.id} className="hover:bg-yellow-50">
                    <td className="px-4 py-2.5 font-mono text-xs text-gray-500">{c.protocolNumber}</td>
                    <td className="px-4 py-2.5 font-medium text-gray-900">{c.student.warName}</td>
                    <td className="px-4 py-2.5 text-xs text-gray-600">{c.student.course.name}</td>
                    <td className="px-4 py-2.5 text-xs text-gray-600">{c.type.name}</td>
                    <td className="px-4 py-2.5 text-xs text-gray-600">{c.decisions[0]?.decisionType ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
