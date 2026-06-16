import { prisma } from "@/lib/db";
import { abreviarPelotao, platoonOrder, formatCadernoNumero } from "@/lib/utils";
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

const CPI_ORDER    = ["CPI 0", "CPI 1", "CPI 2", "CPI 3"];
const ELOGIO_ORDER = ["Referência Elogiosa", "Elogio publicado em BI"];
const TD_TAC_TIPOS = new Set(["TD Leve", "TD Média", "TD Grave", "TAC"]);
const TIPO_ORDER   = [...CPI_ORDER, ...ELOGIO_ORDER, "Arquivamento", "TD Leve", "TD Média", "TD Grave", "TAC"];

function cpiDoReenquadramento(article: string | null, inciso: string | null, fallback: string): string {
  if (!inciso) return fallback;
  if (article === "146" && inciso === "I") return "CPI 0";
  const map: Record<string, string> = { I: "CPI 1", II: "CPI 2", III: "CPI 3" };
  return map[inciso] ?? fallback;
}

const CPI0_NOTE = "CPI de Grau 0 — sanção equivalente à metade da CPI 1 (−0,1 pt)";

const TIPO_NOTE: Record<string, string> = {
  "CPI 0": CPI0_NOTE,
};

const TIPOS_FAVORAVEIS = new Set(["Referência Elogiosa", "Elogio publicado em BI"]);

function scoreDisplay(score: number | null, recordType: string) {
  if (score == null || score === 0) return null;
  const fav = TIPOS_FAVORAVEIS.has(recordType);
  const mag = Math.abs(score);
  return { fav, text: `${fav ? "+" : "−"}${mag.toFixed(1)}` };
}

function decisaoLabel(decisionSummary: string, recordType: string): string {
  if (decisionSummary === "Reenquadrar artigo") return "Reenquadrar";
  if (decisionSummary.toLowerCase().includes("arquiv") || recordType === "Arquivamento") return "Arquivar";
  if (TIPOS_FAVORAVEIS.has(recordType)) return "Deferir";
  return "Sanção";
}

function sortByPlatoonThenNum<T extends { studentCourseNumber: string; student: { platoon: { name: string } | null } }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const pa = platoonOrder(a.student.platoon?.name);
    const pb = platoonOrder(b.student.platoon?.name);
    if (pa !== pb) return pa - pb;
    return (parseInt(a.studentCourseNumber, 10) || 0) - (parseInt(b.studentCourseNumber, 10) || 0);
  });
}

type GrupoItem = {
  id: string; communicationId: string; score: number | null; recordType: string;
  decisionSummary: string; studentCourseNumber: string; studentWarName: string;
  factDate: Date; student: { platoon: { name: string } | null };
  communication: { protocolNumber: string; article: string | null; item: string | null; letter: string | null; adaptationPeriod: boolean };
};

function TabelaGrupo({ items, thBase, tdBase }: { items: GrupoItem[]; thBase: string; tdBase: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-[#1e3a5f] text-white">
          <tr>
            <th className={thBase}>Protocolo</th>
            <th className={thBase}>Enquadramento</th>
            <th className={thBase}>Pelotão</th>
            <th className={thBase}>Nº</th>
            <th className={thBase}>Nome de Guerra</th>
            <th className={thBase}>Tipo</th>
            <th className={thBase}>Data</th>
            <th className={thBase}>Decisão</th>
            <th className={`${thBase} text-right`}>Pont.</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {items.map((item, idx) => (
            <tr key={item.id} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
              <td className={`${tdBase} font-mono whitespace-nowrap`}>
                <a href={`/comunicacoes/${item.communicationId}`} className="text-blue-700 hover:underline">
                  {item.communication.protocolNumber}
                </a>
              </td>
              <td className={`${tdBase} text-gray-600 whitespace-nowrap`}>{fmtEnq(item.communication.article, item.communication.item, item.communication.letter)}</td>
              <td className={`${tdBase} text-gray-600 whitespace-nowrap`}>{abreviarPelotao(item.student.platoon?.name)}</td>
              <td className={`${tdBase} font-mono text-gray-700 whitespace-nowrap`}>{item.studentCourseNumber}</td>
              <td className={`${tdBase} font-semibold text-gray-900 whitespace-nowrap`}>{item.studentWarName}</td>
              <td className={`${tdBase} text-gray-700 whitespace-nowrap`}>{item.recordType}</td>
              <td className={`${tdBase} text-gray-500 whitespace-nowrap`}>{new Date(item.factDate).toLocaleDateString("pt-BR")}</td>
              <td className={`${tdBase} text-gray-700 whitespace-nowrap font-medium`}>{decisaoLabel(item.decisionSummary, item.recordType)}</td>
              <td className={`${tdBase} text-right font-bold`}>
                {(() => {
                  const sd = scoreDisplay(item.score, item.recordType);
                  if (sd) return <span className={sd.fav ? "text-green-600" : "text-red-600"}>{sd.text}</span>;
                  if (item.communication.adaptationPeriod) return <span className="text-orange-600 font-normal text-xs">P. adapt.</span>;
                  return <span className="text-gray-400">—</span>;
                })()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
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
          communication: { select: { protocolNumber: true, article: true, item: true, letter: true, adaptationPeriod: true } },
        },
      },
    },
  });
  if (!caderno) notFound();

  const numero = formatCadernoNumero(caderno);

  const canEdit = [
    "ADMINISTRADOR", "PROTOCOLO",
    "COMANDANTE_ESFAP", "COMANDANTE_ESFO", "CHEFE_DIVISAO_ACADEMICA",
    "SUBCOMANDANTE_ESFAP", "SUBCOMANDANTE_ESFO", "OFICIAL_ESFAP", "OFICIAL_ESFO",
  ].includes(session.role) && caderno.status !== "PUBLICADO";

  const isArquivado = (i: { decisionSummary: string; recordType: string }) =>
    i.recordType === "Arquivamento" ||
    (i.decisionSummary ?? "").toLowerCase().includes("arquiv");

  // Separa: reenquadramentos, arquivamentos, TD/TAC e demais
  const reenquadrados = sortByPlatoonThenNum(caderno.items.filter(i => i.decisionSummary === "Reenquadrar artigo"));
  const arquivados    = sortByPlatoonThenNum(caderno.items.filter(i => i.decisionSummary !== "Reenquadrar artigo" && isArquivado(i)));
  const tdTacItems    = sortByPlatoonThenNum(caderno.items.filter(i =>
    i.decisionSummary !== "Reenquadrar artigo" && !isArquivado(i) && TD_TAC_TIPOS.has(i.recordType)
  ));
  const demais        = caderno.items.filter(i =>
    i.decisionSummary !== "Reenquadrar artigo" && !isArquivado(i) && !TD_TAC_TIPOS.has(i.recordType)
  );

  const grupos = new Map<string, typeof caderno.items>();
  for (const item of demais) {
    if (!grupos.has(item.recordType)) grupos.set(item.recordType, []);
    grupos.get(item.recordType)!.push(item);
  }
  for (const [, arr] of grupos) arr.sort((a, b) => {
    const pa = platoonOrder(a.student.platoon?.name);
    const pb = platoonOrder(b.student.platoon?.name);
    if (pa !== pb) return pa - pb;
    return (parseInt(a.studentCourseNumber, 10) || 0) - (parseInt(b.studentCourseNumber, 10) || 0);
  });

  const mkGrupo = (order: string[]) => [
    ...order.filter(t => grupos.has(t)).map(t => ({ tipo: t, items: grupos.get(t)! })),
    ...[...grupos.entries()]
      .filter(([t]) => !TIPO_ORDER.includes(t) && order === CPI_ORDER)
      .map(([t, items]) => ({ tipo: t, items })),
  ];

  const gruposCPI    = mkGrupo(CPI_ORDER);
  const gruposElogio = mkGrupo(ELOGIO_ORDER);

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
      <div className="grid grid-cols-2 sm:grid-cols-6 gap-3 mb-6">
        <div className="bg-blue-600 rounded-xl p-4 text-white">
          <p className="text-3xl font-bold">{caderno.items.length}</p>
          <p className="text-xs opacity-90 mt-1">Total de registros</p>
        </div>
        <div className="bg-red-600 rounded-xl p-4 text-white">
          <p className="text-3xl font-bold">{gruposCPI.reduce((s, g) => s + g.items.length, 0) + reenquadrados.length}</p>
          <p className="text-xs opacity-90 mt-1">Punições (CPI)</p>
        </div>
        <div className="bg-orange-600 rounded-xl p-4 text-white">
          <p className="text-3xl font-bold">{tdTacItems.length}</p>
          <p className="text-xs opacity-90 mt-1">TD / TAC</p>
        </div>
        <div className="bg-green-600 rounded-xl p-4 text-white">
          <p className="text-3xl font-bold">{gruposElogio.reduce((s, g) => s + g.items.length, 0)}</p>
          <p className="text-xs opacity-90 mt-1">Favoráveis</p>
        </div>
        <div className="bg-gray-500 rounded-xl p-4 text-white">
          <p className="text-3xl font-bold">{arquivados.length}</p>
          <p className="text-xs opacity-90 mt-1">Arquivamentos</p>
        </div>
        <div className="bg-orange-100 rounded-xl p-4 text-orange-800">
          <p className="text-3xl font-bold">{totalReenquadrados}</p>
          <p className="text-xs mt-1">Reenquadramentos</p>
        </div>
      </div>

      {/* Seções na ordem: CPI 0 → CPI 1 → CPI 2 → CPI 3 → Reenquadramento → RE → EBI → Arquivamentos */}
      <div className="space-y-8">

        {/* CPIs */}
        {gruposCPI.map(({ tipo, items }) => (
          <div key={tipo}>
            <h2 className="text-base font-bold text-gray-800 mb-1 flex items-center gap-2">
              <span className="inline-block w-2 h-2 rounded-full bg-[#1e3a5f]" />
              {tipo}
              <span className="text-xs font-normal text-gray-400">({items.length} registro{items.length !== 1 ? "s" : ""})</span>
            </h2>
            {TIPO_NOTE[tipo] && (
              <p className="text-xs text-gray-500 mb-2 ml-4 italic">{TIPO_NOTE[tipo]}</p>
            )}
            <TabelaGrupo items={items} thBase={thBase} tdBase={tdBase} />
          </div>
        ))}

        {/* TD / TAC */}
        {tdTacItems.length > 0 && (
          <div>
            <h2 className="text-base font-bold text-orange-800 mb-2 flex items-center gap-2">
              <span className="inline-block w-2 h-2 rounded-full bg-orange-600" />
              TD / TAC — Transgressões Disciplinares e Termos de Ajuste de Conduta
              <span className="text-xs font-normal text-gray-400">({tdTacItems.length} registro{tdTacItems.length !== 1 ? "s" : ""})</span>
            </h2>
            <div className="bg-white rounded-xl border border-orange-200 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-orange-700 text-white">
                  <tr>
                    <th className={thBase}>Protocolo</th>
                    <th className={thBase}>Enquadramento</th>
                    <th className={thBase}>Pelotão</th>
                    <th className={thBase}>Nº</th>
                    <th className={thBase}>Nome de Guerra</th>
                    <th className={thBase}>Data</th>
                    <th className={thBase}>Decisão</th>
                    <th className={`${thBase} text-right`}>Pont.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-orange-100">
                  {tdTacItems.map((item, idx) => (
                    <tr key={item.id} className={idx % 2 === 0 ? "bg-white" : "bg-orange-50"}>
                      <td className={`${tdBase} font-mono whitespace-nowrap`}>
                        <a href={`/comunicacoes/${item.communicationId}`} className="text-blue-700 hover:underline">
                          {item.communication.protocolNumber}
                        </a>
                      </td>
                      <td className={`${tdBase} text-gray-700 whitespace-nowrap font-medium`}>{item.decisionSummary}</td>
                      <td className={`${tdBase} text-gray-600 whitespace-nowrap`}>{abreviarPelotao(item.student.platoon?.name)}</td>
                      <td className={`${tdBase} font-mono text-gray-700 whitespace-nowrap`}>{item.studentCourseNumber}</td>
                      <td className={`${tdBase} font-semibold text-gray-900 whitespace-nowrap`}>{item.studentWarName}</td>
                      <td className={`${tdBase} text-gray-500 whitespace-nowrap`}>{new Date(item.factDate).toLocaleDateString("pt-BR")}</td>
                      <td className={`${tdBase} text-orange-800 whitespace-nowrap font-medium`}>Sanção</td>
                      <td className={`${tdBase} text-right font-bold`}>
                        {item.score != null && item.score > 0
                          ? <span className="text-red-600">−{item.score.toFixed(1)}</span>
                          : item.communication.adaptationPeriod
                            ? <span className="text-orange-600 font-normal text-xs">P. adapt.</span>
                            : <span className="text-gray-400">—</span>
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Reenquadramentos */}
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
                    <th className={thBase}>Pelotão</th>
                    <th className={thBase}>Nº</th>
                    <th className={thBase}>Nome de Guerra</th>
                    <th className={thBase}>Tipo</th>
                    <th className={thBase}>Data</th>
                    <th className={`${thBase} text-right`}>Pont.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {reenquadrados.map((item, idx) => (
                    <tr key={item.id} className={idx % 2 === 0 ? "bg-white" : "bg-orange-50"}>
                      <td className={`${tdBase} font-mono whitespace-nowrap`}>
                        <Link href={`/comunicacoes/${item.communicationId}`} className="text-blue-700 hover:underline">
                          {item.communication.protocolNumber}
                        </Link>
                      </td>
                      <td className={`${tdBase} text-gray-600 whitespace-nowrap`}>{fmtEnq(item.originalArticle, item.originalItem, item.originalLetter)}</td>
                      <td className={`${tdBase} font-semibold text-orange-700 whitespace-nowrap`}>{fmtEnq(item.communication.article, item.communication.item, item.communication.letter)}</td>
                      <td className={`${tdBase} text-gray-600 whitespace-nowrap`}>{abreviarPelotao(item.student.platoon?.name)}</td>
                      <td className={`${tdBase} font-mono text-gray-700 whitespace-nowrap`}>{item.studentCourseNumber}</td>
                      <td className={`${tdBase} font-semibold text-gray-900 whitespace-nowrap`}>{item.studentWarName}</td>
                      <td className={`${tdBase} text-gray-700 whitespace-nowrap`}>
                        {cpiDoReenquadramento(item.communication.article, item.communication.item, item.recordType)}
                      </td>
                      <td className={`${tdBase} text-gray-500 whitespace-nowrap`}>{format(new Date(item.factDate), "dd/MM/yyyy", { locale: ptBR })}</td>
                      <td className={`${tdBase} text-right font-bold`}>
                        {(() => {
                          const sd = scoreDisplay(item.score, item.recordType);
                          if (sd) return <span className={sd.fav ? "text-green-600" : "text-red-600"}>{sd.text}</span>;
                          if (item.communication.adaptationPeriod) return <span className="text-orange-600 font-normal text-xs">P. adapt.</span>;
                          return <span className="text-gray-400">—</span>;
                        })()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Referências Elogiosas e Elogios em BI */}
        {gruposElogio.map(({ tipo, items }) => (
          <div key={tipo}>
            <h2 className="text-base font-bold text-gray-800 mb-1 flex items-center gap-2">
              <span className="inline-block w-2 h-2 rounded-full bg-[#1e3a5f]" />
              {tipo}
              <span className="text-xs font-normal text-gray-400">({items.length} registro{items.length !== 1 ? "s" : ""})</span>
            </h2>
            <TabelaGrupo items={items} thBase={thBase} tdBase={tdBase} />
          </div>
        ))}

        {/* Arquivamentos */}
        {arquivados.length > 0 && (
          <div>
            <h2 className="text-base font-bold text-gray-600 mb-2 flex items-center gap-2">
              <span className="inline-block w-2 h-2 rounded-full bg-gray-400" />
              Arquivamentos
              <span className="text-xs font-normal text-gray-400">({arquivados.length} registro{arquivados.length !== 1 ? "s" : ""})</span>
            </h2>
            <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-100 text-gray-700">
                  <tr>
                    <th className={thBase}>Protocolo</th>
                    <th className={thBase}>Enquadramento</th>
                    <th className={thBase}>Pelotão</th>
                    <th className={thBase}>Nº</th>
                    <th className={thBase}>Nome de Guerra</th>
                    <th className={thBase}>Tipo original</th>
                    <th className={thBase}>Data</th>
                    <th className={thBase}>Decisão</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {arquivados.map((item, idx) => (
                    <tr key={item.id} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                      <td className={`${tdBase} font-mono whitespace-nowrap`}>
                        <Link href={`/comunicacoes/${item.communicationId}`} className="text-blue-700 hover:underline">
                          {item.communication.protocolNumber}
                        </Link>
                      </td>
                      <td className={`${tdBase} text-gray-600 whitespace-nowrap`}>{fmtEnq(item.communication.article, item.communication.item, item.communication.letter)}</td>
                      <td className={`${tdBase} text-gray-600 whitespace-nowrap`}>{abreviarPelotao(item.student.platoon?.name)}</td>
                      <td className={`${tdBase} font-mono text-gray-700 whitespace-nowrap`}>{item.studentCourseNumber}</td>
                      <td className={`${tdBase} font-semibold text-gray-900 whitespace-nowrap`}>{item.studentWarName}</td>
                      <td className={`${tdBase} text-gray-500 whitespace-nowrap`}>{item.recordType}</td>
                      <td className={`${tdBase} text-gray-500 whitespace-nowrap`}>{format(new Date(item.factDate), "dd/MM/yyyy", { locale: ptBR })}</td>
                      <td className={`${tdBase} text-gray-500 font-medium`}>
                        Arquivar
                        {item.communication.adaptationPeriod && (
                          <span className="block text-orange-600 font-normal text-xs leading-tight">P. adapt.</span>
                        )}
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
      <div className="mt-4 text-xs text-gray-500">
        <span>{caderno.items.length} registro(s) total</span>
      </div>
    </div>
  );
}
