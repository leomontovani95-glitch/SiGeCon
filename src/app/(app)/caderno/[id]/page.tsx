import { prisma } from "@/lib/db";
import { verifySession } from "@/lib/dal";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import Link from "next/link";

function fmtEnq(art: string | null, inc: string | null, al: string | null) {
  if (!art) return "—";
  let s = `Art. ${art}`;
  if (inc) s += `, ${inc}`;
  if (al) s += `, ${al})`;
  return s;
}

const TIPO_ORDER = [
  "CPI 0", "CPI 1", "CPI 2", "CPI 3",
  "Referência Elogiosa", "Elogio publicado em BI", "Arquivamento",
];

const TIPOS_FAVORAVEIS = new Set(["Referência Elogiosa", "Elogio publicado em BI"]);

function scoreDisplay(score: number | null, recordType: string) {
  if (score == null || score === 0) return null;
  const fav = TIPOS_FAVORAVEIS.has(recordType);
  const mag = Math.abs(score);
  return { fav, text: `${fav ? "+" : "−"}${mag.toFixed(1)}` };
}

function sortByNum<T extends { studentCourseNumber: string }>(items: T[]): T[] {
  return [...items].sort((a, b) =>
    (parseInt(a.studentCourseNumber, 10) || 0) - (parseInt(b.studentCourseNumber, 10) || 0)
  );
}

export default async function CadernoDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await verifySession();
  const { id } = await params;
  const caderno = await prisma.disciplinaryBook.findUnique({
    where: { id },
    include: {
      createdBy: true,
      publishedBy: true,
      course: true,
      items: {
        include: {
          student: { include: { course: true, platoon: true } },
          communication: { select: { protocolNumber: true, article: true, item: true, letter: true } },
        },
      },
    },
  });
  if (!caderno) notFound();

  const numero = caderno.course
    ? `CD Nº ${String(caderno.number).padStart(2, "0")} — ${caderno.course.name}`
    : `CD-${String(caderno.number).padStart(4, "0")}`;

  const canEdit = ["ADMINISTRADOR", "PROTOCOLO", "COMANDANTE_ESFAP", "COMANDANTE_ESFO", "CHEFE_DIVISAO_ACADEMICA"].includes(session.role)
    && caderno.status !== "PUBLICADO";

  // Separa reenquadramentos e agrupa o restante por tipo
  const reenquadrados = sortByNum(caderno.items.filter(i => i.decisionSummary === "Reenquadrar artigo"));
  const demais       = caderno.items.filter(i => i.decisionSummary !== "Reenquadrar artigo");

  const grupos = new Map<string, typeof caderno.items>();
  for (const item of demais) {
    if (!grupos.has(item.recordType)) grupos.set(item.recordType, []);
    grupos.get(item.recordType)!.push(item);
  }
  for (const [, arr] of grupos) arr.sort((a, b) =>
    (parseInt(a.studentCourseNumber, 10) || 0) - (parseInt(b.studentCourseNumber, 10) || 0)
  );

  const gruposOrdenados = [
    ...TIPO_ORDER.filter(t => grupos.has(t)).map(t => ({ tipo: t, items: grupos.get(t)! })),
    ...[...grupos.entries()].filter(([t]) => !TIPO_ORDER.includes(t)).map(([t, items]) => ({ tipo: t, items })),
  ];

  const totalFav = caderno.items
    .filter((i) => TIPOS_FAVORAVEIS.has(i.recordType))
    .reduce((s, i) => s + Math.abs(i.score ?? 0), 0);
  const totalReenquadrados = reenquadrados.length;

  // Colunas base compartilhadas
  const thBase = "text-left px-3 py-2.5 font-medium whitespace-nowrap text-xs";
  const tdBase = "px-3 py-2 text-xs";

  return (
    <div className="p-6">
      {/* Cabeçalho */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{numero}</h1>
          <p className="text-sm text-gray-500 mt-1">
            {caderno.status === "PUBLICADO"
              ? `Publicado em ${format(new Date(caderno.publicationDate!), "dd/MM/yyyy", { locale: ptBR })} por ${caderno.publishedBy?.warName ?? "—"}`
              : "Rascunho — ainda não publicado"}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap justify-end">
          {canEdit && <Link href={`/caderno/${id}/editar`} className="btn-secondary text-xs">Revisar / Publicar</Link>}
          <Link href={`/caderno/${id}/imprimir`} target="_blank" className="btn-secondary text-xs">Gerar PDF</Link>
        </div>
      </div>

      {/* Cards resumo */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
        <div className="bg-blue-600 rounded-xl p-4 text-white">
          <p className="text-3xl font-bold">{caderno.items.length}</p>
          <p className="text-xs opacity-90 mt-1">Total de registros</p>
        </div>
        <div className="bg-red-600 rounded-xl p-4 text-white">
          <p className="text-3xl font-bold">{caderno.items.filter(i => i.recordType.startsWith("CPI")).length}</p>
          <p className="text-xs opacity-90 mt-1">Punições (CPI)</p>
        </div>
        <div className="bg-green-600 rounded-xl p-4 text-white">
          <p className="text-3xl font-bold">{caderno.items.filter(i => TIPOS_FAVORAVEIS.has(i.recordType)).length}</p>
          <p className="text-xs opacity-90 mt-1">Favoráveis</p>
        </div>
        <div className="bg-gray-500 rounded-xl p-4 text-white">
          <p className="text-3xl font-bold">{caderno.items.filter(i => !i.score).length}</p>
          <p className="text-xs opacity-90 mt-1">Arquivamentos</p>
        </div>
        <div className="bg-orange-100 rounded-xl p-4 text-orange-800">
          <p className="text-3xl font-bold">{totalReenquadrados}</p>
          <p className="text-xs mt-1">Reenquadramentos</p>
        </div>
      </div>

      {/* Seções por tipo */}
      <div className="space-y-8">
        {gruposOrdenados.map(({ tipo, items }) => (
          <div key={tipo}>
            <h2 className="text-base font-bold text-gray-800 mb-2 flex items-center gap-2">
              <span className="inline-block w-2 h-2 rounded-full bg-[#1e3a5f]" />
              {tipo}
              <span className="text-xs font-normal text-gray-400">({items.length} registro{items.length !== 1 ? "s" : ""})</span>
            </h2>
            <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-[#1e3a5f] text-white">
                  <tr>
                    <th className={thBase}>Protocolo</th>
                    <th className={thBase}>Enquadramento</th>
                    <th className={thBase}>Curso</th>
                    <th className={thBase}>Pelotão</th>
                    <th className={thBase}>Nº</th>
                    <th className={thBase}>Nome de Guerra</th>
                    <th className={thBase}>Tipo</th>
                    <th className={thBase}>Data Fato</th>
                    <th className={thBase}>Decisão</th>
                    <th className={`${thBase} text-right`}>Pont.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {items.map((item, idx) => (
                    <tr key={item.id} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                      <td className={`${tdBase} font-mono`}>
                        <Link href={`/comunicacoes/${item.communicationId}`} className="text-blue-700 hover:underline">
                          {item.communication.protocolNumber}
                        </Link>
                      </td>
                      <td className={`${tdBase} text-gray-600 whitespace-nowrap`}>
                        {fmtEnq(item.communication.article, item.communication.item, item.communication.letter)}
                      </td>
                      <td className={`${tdBase} text-gray-700`}>{item.student.course.name}</td>
                      <td className={`${tdBase} text-gray-600`}>{item.student.platoon?.name ?? "—"}</td>
                      <td className={`${tdBase} font-mono text-gray-700`}>{item.studentCourseNumber}</td>
                      <td className={`${tdBase} font-semibold text-gray-900`}>{item.studentWarName}</td>
                      <td className={`${tdBase} text-gray-700`}>{item.recordType}</td>
                      <td className={`${tdBase} text-gray-500 whitespace-nowrap`}>
                        {format(new Date(item.factDate), "dd/MM/yyyy", { locale: ptBR })}
                      </td>
                      <td className={`${tdBase} text-gray-700`}>{item.decisionSummary}</td>
                      <td className={`${tdBase} text-right font-bold`}>
                        {(() => { const sd = scoreDisplay(item.score, item.recordType); return sd ? <span className={sd.fav ? "text-green-600" : "text-red-600"}>{sd.text}</span> : <span className="text-gray-400">—</span>; })()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}

        {/* Grupo Reenquadramento */}
        {reenquadrados.length > 0 && (
          <div>
            <h2 className="text-base font-bold text-orange-700 mb-2 flex items-center gap-2">
              <span className="inline-block w-2 h-2 rounded-full bg-orange-400" />
              Reenquadramento
              <span className="text-xs font-normal text-gray-400">({reenquadrados.length} registro{reenquadrados.length !== 1 ? "s" : ""})</span>
            </h2>
            <div className="bg-white rounded-xl border border-orange-200 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-orange-100 text-orange-900">
                  <tr>
                    <th className={thBase}>Protocolo</th>
                    <th className={thBase}>Enquadramento original</th>
                    <th className={thBase}>Reenquadrado para</th>
                    <th className={thBase}>Curso</th>
                    <th className={thBase}>Pelotão</th>
                    <th className={thBase}>Nº</th>
                    <th className={thBase}>Nome de Guerra</th>
                    <th className={thBase}>Tipo</th>
                    <th className={thBase}>Data Fato</th>
                    <th className={`${thBase} text-right`}>Pont.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {reenquadrados.map((item, idx) => (
                    <tr key={item.id} className={idx % 2 === 0 ? "bg-white" : "bg-orange-50"}>
                      <td className={`${tdBase} font-mono`}>
                        <Link href={`/comunicacoes/${item.communicationId}`} className="text-blue-700 hover:underline">
                          {item.communication.protocolNumber}
                        </Link>
                      </td>
                      <td className={`${tdBase} text-gray-600 whitespace-nowrap`}>
                        {fmtEnq(item.originalArticle, item.originalItem, item.originalLetter)}
                      </td>
                      <td className={`${tdBase} font-semibold text-orange-700 whitespace-nowrap`}>
                        {fmtEnq(item.communication.article, item.communication.item, item.communication.letter)}
                      </td>
                      <td className={`${tdBase} text-gray-700`}>{item.student.course.name}</td>
                      <td className={`${tdBase} text-gray-600`}>{item.student.platoon?.name ?? "—"}</td>
                      <td className={`${tdBase} font-mono text-gray-700`}>{item.studentCourseNumber}</td>
                      <td className={`${tdBase} font-semibold text-gray-900`}>{item.studentWarName}</td>
                      <td className={`${tdBase} text-gray-700`}>{item.recordType}</td>
                      <td className={`${tdBase} text-gray-500 whitespace-nowrap`}>
                        {format(new Date(item.factDate), "dd/MM/yyyy", { locale: ptBR })}
                      </td>
                      <td className={`${tdBase} text-right font-bold`}>
                        {(() => { const sd = scoreDisplay(item.score, item.recordType); return sd ? <span className={sd.fav ? "text-green-600" : "text-red-600"}>{sd.text}</span> : <span className="text-gray-400">—</span>; })()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {caderno.items.length === 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-10 text-center text-gray-400">
            Nenhum registro nesta edição.
          </div>
        )}
      </div>

      {/* Rodapé */}
      <div className="mt-4 text-xs text-gray-500 flex gap-6">
        <span>{caderno.items.length} registro(s) total</span>
        {totalFav > 0 && <span className="text-green-600">Total favorável publicado: +{totalFav.toFixed(1)} pt</span>}
      </div>
    </div>
  );
}
