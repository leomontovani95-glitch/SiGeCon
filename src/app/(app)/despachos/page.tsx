import { prisma } from "@/lib/db";
import { verifySession, getSchoolFilter, COMANDANTES, PARECERISTAS, VIEWERS_APM } from "@/lib/dal";
import { coresTipo } from "@/lib/coresComunicacao";
import { redirect } from "next/navigation";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import Link from "next/link";

// Ordem de exibição dos grupos de tipo nos despachos. Tipos fora desta lista
// (ex.: TD/TAC, que nascem já decididos) caem em "Outros", ao final.
const ORDEM_TIPOS = [
  "CPI 1", "CPI 2", "CPI 3",
  "Referência Elogiosa", "Elogio publicado em BI",
  "TD Leve", "TD Média", "TD Grave", "TAC", "Arquivamento",
];

// Chave de cor por tipo (reaproveita a paleta única do caderno/análise).
function chaveCor(tipo: string): string {
  if (tipo.startsWith("TD") || tipo === "TAC") return "TD / TAC";
  return tipo;
}

const STATUS_LABELS: Record<string, string> = {
  AGUARDANDO_PARECER:          "Ag. Parecer",
  JUSTIFICATIVA_APRESENTADA:   "Defesa Apresentada",
  AGUARDANDO_DECISAO:          "Ag. Decisão",
  AGUARDANDO_DECISAO_DIVISAO:  "Ag. Decisão (Div. Acadêmica)",
};

const STATUS_COLORS: Record<string, string> = {
  AGUARDANDO_PARECER:          "bg-purple-100 text-purple-700",
  JUSTIFICATIVA_APRESENTADA:   "bg-orange-100 text-orange-700",
  AGUARDANDO_DECISAO:          "bg-indigo-100 text-indigo-700",
  AGUARDANDO_DECISAO_DIVISAO:  "bg-sky-100 text-sky-700",
};

const DECISORES = COMANDANTES as string[];

export default async function DespachoPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const session = await verifySession();
  const { role } = session;

  const isParecerista = (PARECERISTAS as string[]).includes(role);
  const isDecisor     = DECISORES.includes(role);
  const isViewer      = (VIEWERS_APM as string[]).includes(role);
  // O Chefe da Divisão Acadêmica só decide CPIs encaminhadas pela Escola; o
  // Administrador acumula os dois papéis de decisão.
  const isChefeDivisao = role === "CHEFE_DIVISAO_ACADEMICA";
  const isAdmin        = role === "ADMINISTRADOR";

  if (!isParecerista && !isDecisor && !isViewer) redirect("/acesso-negado");

  const sp = await searchParams;
  const cursoId = sp.cursoId ?? "";

  const school = getSchoolFilter(role, session.escola);

  // Cursos disponíveis para o seletor
  const cursosDisponiveis = await prisma.course.findMany({
    where: { active: true, ...(school ? { school } : {}) },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  // Monta filtro de escola/curso
  const cursoFilter = cursoId
    ? { courseId: cursoId }
    : school
      ? { course: { school } }
      : {};

  // Filtro de status por perfil
  const statusFilter = isViewer
    ? { status: { in: ["AGUARDANDO_PARECER", "JUSTIFICATIVA_APRESENTADA", "AGUARDANDO_DECISAO", "AGUARDANDO_DECISAO_DIVISAO"] } }
    : isParecerista
      ? { status: { in: ["AGUARDANDO_PARECER", "JUSTIFICATIVA_APRESENTADA"] } }
      : isChefeDivisao
        ? { status: "AGUARDANDO_DECISAO_DIVISAO" }
        : isAdmin
          ? { status: { in: ["AGUARDANDO_DECISAO", "AGUARDANDO_DECISAO_DIVISAO"] } }
          : { status: "AGUARDANDO_DECISAO" };

  const comunicacoes = await prisma.communication.findMany({
    where: { ...statusFilter, ...cursoFilter },
    // Ordem crescente de protocolo: as primeiras geradas são respondidas antes.
    orderBy: { protocolNumber: "asc" },
    include: {
      type: true,
      student: { include: { course: true } },
      defenses: { select: { id: true } },
      opinions: { select: { id: true } },
    },
  });

  // Agrupa por tipo, preservando a ordem crescente de protocolo dentro de cada
  // grupo, e ordena os grupos conforme ORDEM_TIPOS (demais ao final).
  const porTipo = new Map<string, typeof comunicacoes>();
  for (const c of comunicacoes) {
    if (!porTipo.has(c.type.name)) porTipo.set(c.type.name, []);
    porTipo.get(c.type.name)!.push(c);
  }
  const gruposTipo = [...porTipo.entries()].sort((a, b) => {
    const ia = ORDEM_TIPOS.indexOf(a[0]); const ib = ORDEM_TIPOS.indexOf(b[0]);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });

  const cursoSelecionado = cursosDisponiveis.find((c) => c.id === cursoId);
  const labelEscopo = school === "ESFAP" ? "Todos da EsFAP"
    : school === "ESFO"  ? "Todos da EsFO"
    : "Todos os cursos";

  function pillHref(id: string) {
    const p = new URLSearchParams();
    if (id) p.set("cursoId", id);
    const qs = p.toString();
    return `/despachos${qs ? `?${qs}` : ""}`;
  }

  return (
    <div className="p-6">
      {/* Título */}
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-gray-900">Despachos</h1>
        <p className="text-sm text-gray-500">
          {cursoSelecionado ? cursoSelecionado.name : labelEscopo}
          {" · "}
          {isViewer
            ? "Visão geral — comunicações pendentes de parecer ou decisão"
            : isParecerista
              ? "Comunicações aguardando emissão de parecer"
              : "Comunicações aguardando decisão final"}
        </p>
      </div>

      {/* Seletor de cursos */}
      {cursosDisponiveis.length > 1 && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-5">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Filtrar por curso</p>
          <div className="flex flex-wrap gap-2">
            <Link
              href={pillHref("")}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                !cursoId ? "bg-[#1e3a5f] text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              {labelEscopo}
            </Link>
            {cursosDisponiveis.map((curso) => (
              <Link
                key={curso.id}
                href={pillHref(curso.id)}
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

      {comunicacoes.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-10 text-center text-gray-400">
          Nenhum despacho pendente{cursoSelecionado ? ` para ${cursoSelecionado.name}` : ""}.
        </div>
      ) : (
        <div className="space-y-6">
          {gruposTipo.map(([tipo, lista]) => {
            const cor = coresTipo(chaveCor(tipo));
            return (
              <div key={tipo}>
                {/* Cabeçalho do grupo de tipo, com a cor da paleta única */}
                <div className="flex items-center gap-2 mb-2">
                  <span className="inline-block w-3 h-3 rounded-sm" style={{ background: cor.bar }} />
                  <h2 className="text-sm font-bold uppercase tracking-wide" style={{ color: cor.title }}>
                    {tipo}
                  </h2>
                  <span className="text-xs text-gray-400 font-medium">({lista.length})</span>
                </div>
                <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="text-left px-3 py-2.5 font-medium text-gray-700 text-xs whitespace-nowrap">Protocolo</th>
                        <th className="text-left px-3 py-2.5 font-medium text-gray-700 text-xs whitespace-nowrap">Aluno</th>
                        <th className="text-left px-3 py-2.5 font-medium text-gray-700 text-xs whitespace-nowrap">Nº</th>
                        <th className="text-left px-3 py-2.5 font-medium text-gray-700 text-xs whitespace-nowrap">Data do Fato</th>
                        <th className="text-left px-3 py-2.5 font-medium text-gray-700 text-xs whitespace-nowrap">Status</th>
                        {!isParecerista && (
                          <th className="text-left px-3 py-2.5 font-medium text-gray-700 text-xs whitespace-nowrap">Parecer</th>
                        )}
                        <th className="text-left px-3 py-2.5 font-medium text-gray-700 text-xs whitespace-nowrap">Ação</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {lista.map((c) => (
                        <tr key={c.id} className="hover:bg-gray-50">
                          <td className="px-3 py-2.5 font-mono text-xs text-gray-700 whitespace-nowrap">{c.protocolNumber}</td>
                          <td className="px-3 py-2.5 text-xs font-medium text-gray-900 whitespace-nowrap">
                            <Link href={`/alunos/${c.student.id}`} className="hover:text-[#1e3a5f] hover:underline">{c.student.warName}</Link>
                          </td>
                          <td className="px-3 py-2.5 font-mono text-xs text-gray-500 whitespace-nowrap">{c.student.courseNumber}</td>
                          <td className="px-3 py-2.5 text-xs text-gray-500 whitespace-nowrap">
                            {format(new Date(c.factDate), "dd/MM/yyyy", { locale: ptBR })}
                          </td>
                          <td className="px-3 py-2.5 whitespace-nowrap">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${STATUS_COLORS[c.status] ?? "bg-gray-100 text-gray-700"}`}>
                              {STATUS_LABELS[c.status] ?? c.status}
                            </span>
                          </td>
                          {!isParecerista && (
                            <td className="px-3 py-2.5 whitespace-nowrap">
                              {c.opinions.length > 0 ? (
                                <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium whitespace-nowrap">Com parecer</span>
                              ) : c.defenses.length > 0 ? (
                                <span className="text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 font-medium whitespace-nowrap">Com defesa</span>
                              ) : (
                                <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 whitespace-nowrap">Sem defesa</span>
                              )}
                            </td>
                          )}
                          <td className="px-3 py-2.5 whitespace-nowrap">
                            <Link
                              href={`/comunicacoes/${c.id}`}
                              className="text-xs font-semibold text-[#1e3a5f] hover:underline whitespace-nowrap"
                            >
                              {isViewer ? "Ver →" : isParecerista ? "Emitir Parecer →" : "Decidir →"}
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
