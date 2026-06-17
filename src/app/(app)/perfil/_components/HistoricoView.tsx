import Link from "next/link";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { faixaNota } from "@/lib/score";
import { type HistoricoAluno, STATUS_COMUNICACAO_LABELS as STATUS } from "@/lib/historico";

// Visão em tela (não imprimível) do histórico de conduta do aluno, exibida na
// aba "Histórico" do Meu Perfil. O PDF/impressão reusa a página imprimível
// existente em /alunos/[id]/historico (botão "Gerar PDF").
export default function HistoricoView({
  historico,
  studentId,
  isCurrent,
  adaptacao,
}: {
  historico: HistoricoAluno;
  studentId: string;
  isCurrent: boolean;
  adaptacao: string;
}) {
  const { aluno, pubItems, nota, desfavoravel, favoravel, evolucao } = historico;
  const faixa = faixaNota(nota);

  // Filtro de Período de Adaptação — afeta o resumo e a lista de comunicações
  // (mesmo comportamento da ficha exibida para quem não é aluno).
  const totalAdaptacao = aluno.communications.filter((c) => c.adaptationPeriod).length;
  const commsVisiveis = adaptacao === "sim"
    ? aluno.communications.filter((c) => c.adaptationPeriod)
    : adaptacao === "nao"
      ? aluno.communications.filter((c) => !c.adaptationPeriod)
      : aluno.communications;
  const pubItemsVisiveis = adaptacao === "sim"
    ? pubItems.filter((i) => i.communication.adaptationPeriod)
    : adaptacao === "nao"
      ? pubItems.filter((i) => !i.communication.adaptationPeriod)
      : pubItems;

  const ct = commsVisiveis.reduce((acc, c) => { acc[c.type.name] = (acc[c.type.name] ?? 0) + 1; return acc; }, {} as Record<string, number>);
  const resumo = [
    { label: "Total",         value: commsVisiveis.length,                    desfav: false, fav: false },
    { label: "Publicados",    value: pubItemsVisiveis.length,                 desfav: false, fav: false },
    { label: "CPI 1",       value: ct["CPI 1"] ?? 0, desfav: true,  fav: false },
    { label: "CPI 2",         value: ct["CPI 2"] ?? 0,                        desfav: true,  fav: false },
    { label: "CPI 3",         value: ct["CPI 3"] ?? 0,                        desfav: true,  fav: false },
    { label: "TD Leve",       value: ct["TD Leve"] ?? 0,                      desfav: true,  fav: false },
    { label: "TD Média",      value: ct["TD Média"] ?? 0,                     desfav: true,  fav: false },
    { label: "TD Grave",      value: ct["TD Grave"] ?? 0,                     desfav: true,  fav: false },
    { label: "TAC",           value: ct["TAC"] ?? 0,                          desfav: true,  fav: false },
    { label: "Arq.",          value: ct["Arquivamento"] ?? 0,                 desfav: false, fav: false },
    { label: "Ref. Elogiosa", value: ct["Referência Elogiosa"] ?? 0,         desfav: false, fav: true  },
    { label: "Elogio BI",     value: ct["Elogio publicado em BI"] ?? 0,       desfav: false, fav: true  },
  ];

  // Preserva aba/histórico selecionado ao trocar o filtro de adaptação
  const adaptHref = (v: string) =>
    `/perfil?aba=historico&hist=${studentId}${v ? `&adaptacao=${v}` : ""}`;

  return (
    <div className="space-y-6">
      {/* Ação: gerar PDF / imprimir */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm text-gray-500">
            Histórico de conduta profissional — {aluno.course.name}
          </p>
          {/* Indicação discreta de qual histórico está sendo visto */}
          {isCurrent ? (
            <span className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-green-50 text-green-700 border border-green-200">
              Atual
            </span>
          ) : (
            <span className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
              Histórico anterior
            </span>
          )}
        </div>
        <Link
          href={`/alunos/${studentId}/historico`}
          target="_blank"
          className="bg-[#1e3a5f] text-white px-4 py-2 rounded-lg text-sm hover:bg-[#16304f] transition-colors"
        >
          Gerar PDF / Imprimir
        </Link>
      </div>

      {/* Nota de conduta */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Nota da Disciplina Conduta Profissional</h2>
        <div className="flex items-center gap-6 flex-wrap">
          <div className={`text-3xl font-bold px-5 py-3 rounded-lg ${faixa.tailwind}`}>
            {nota.toFixed(2)}
          </div>
          <div className="text-sm text-gray-700 space-y-0.5">
            <p>Situação: <strong>{faixa.label}</strong></p>
            <p>Pontuação desfavorável total: <strong className="text-red-600">−{desfavoravel.toFixed(1)}</strong></p>
            <p>Pontuação favorável total: <strong className="text-green-600">+{favoravel.toFixed(1)}</strong></p>
            <p className="text-xs text-gray-500">Nota base 10,00 · cálculo: 10 − desfavorável + favorável</p>
            {nota < 6 && <p className="text-xs font-bold text-red-800">SITUAÇÃO: REPROVADO (nota abaixo de 6,0)</p>}
            {nota >= 6 && nota < 7 && <p className="text-xs font-bold text-red-600">ATENÇÃO: zona de risco (nota abaixo de 7,0)</p>}
          </div>
        </div>
      </div>

      {/* Filtro de Período de Adaptação — acima do resumo */}
      <div className="bg-white rounded-xl border border-gray-200 px-5 py-3 flex items-center gap-3 flex-wrap">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Período de Adaptação</span>
        <div className="flex gap-1.5">
          {[
            { v: "",    label: `Todos (${aluno.communications.length})` },
            { v: "sim", label: `Sim (${totalAdaptacao})` },
            { v: "nao", label: `Não (${aluno.communications.length - totalAdaptacao})` },
          ].map(({ v, label }) => (
            <Link
              key={v}
              href={adaptHref(v)}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                adaptacao === v
                  ? "bg-orange-500 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {label}
            </Link>
          ))}
        </div>
        {adaptacao && (
          <span className="text-xs text-orange-700 bg-orange-50 border border-orange-200 rounded px-2 py-0.5">
            Resumo e histórico filtrados por P. Adaptação = {adaptacao === "sim" ? "Sim" : "Não"}
          </span>
        )}
      </div>

      {/* Resumo de Registros */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Resumo de Registros</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {resumo.map(({ label }) => (
                  <th key={label} className="px-3 py-2 text-center text-xs font-medium text-gray-500 whitespace-nowrap">{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                {resumo.map(({ label, value, desfav, fav }) => (
                  <td key={label} className={`px-3 py-3 text-center text-base font-bold ${value > 0 && desfav ? "text-red-700" : value > 0 && fav ? "text-green-700" : value > 0 ? "text-gray-800" : "text-gray-300"}`}>
                    {value}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Evolução da nota por caderno */}
      {evolucao.length > 1 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Evolução da nota por caderno publicado</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-3 py-2 font-medium text-gray-700">Caderno</th>
                  <th className="text-left px-3 py-2 font-medium text-gray-700">Publicação</th>
                  <th className="text-right px-3 py-2 font-medium text-gray-700">Nota acumulada</th>
                  <th className="text-right px-3 py-2 font-medium text-gray-700">Variação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                <tr>
                  <td className="px-3 py-2 italic text-gray-400">Início do curso</td>
                  <td className="px-3 py-2 text-gray-400">—</td>
                  <td className="px-3 py-2 text-right font-bold">10,00</td>
                  <td className="px-3 py-2 text-right text-gray-400">—</td>
                </tr>
                {evolucao.map((e, i) => {
                  const anterior = i === 0 ? 10 : evolucao[i - 1].nota;
                  const variacao = e.nota - anterior;
                  return (
                    <tr key={e.label}>
                      <td className="px-3 py-2 font-mono text-xs text-gray-700">{e.label}</td>
                      <td className="px-3 py-2 text-gray-600">{format(e.date, "dd/MM/yyyy", { locale: ptBR })}</td>
                      <td className="px-3 py-2 text-right font-bold">{e.nota.toFixed(2)}</td>
                      <td className={`px-3 py-2 text-right font-bold ${variacao < 0 ? "text-red-600" : variacao > 0 ? "text-green-600" : "text-gray-400"}`}>
                        {variacao === 0 ? "—" : `${variacao > 0 ? "+" : ""}${variacao.toFixed(2)}`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Comunicações */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
          Comunicações ({commsVisiveis.length})
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-3 py-2 font-medium text-gray-700">Protocolo</th>
                <th className="text-left px-3 py-2 font-medium text-gray-700">Tipo</th>
                <th className="text-left px-3 py-2 font-medium text-gray-700">Data do fato</th>
                <th className="text-left px-3 py-2 font-medium text-gray-700">Status</th>
                <th className="text-right px-3 py-2 font-medium text-gray-700">Pontuação</th>
                <th className="text-left px-3 py-2 font-medium text-gray-700">Decisão</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {commsVisiveis.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-3 py-2 font-mono text-xs text-gray-700">{c.protocolNumber}</td>
                  <td className="px-3 py-2 text-gray-700">{c.type.name}</td>
                  <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{format(new Date(c.factDate), "dd/MM/yyyy", { locale: ptBR })}</td>
                  <td className="px-3 py-2 text-gray-600 text-xs">
                    {STATUS[c.status] ?? c.status}
                    {c.adaptationPeriod && (
                      <span className="ml-1 text-[10px] font-bold text-orange-700 border border-orange-400 rounded px-1">PA</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right font-bold">
                    {c.finalScore != null ? (
                      <span className={c.type.scoreNature === "DESFAVORAVEL" ? "text-red-600" : "text-green-600"}>
                        {c.type.scoreNature === "DESFAVORAVEL" ? "−" : "+"}{c.finalScore.toFixed(1)}
                      </span>
                    ) : <span className="text-gray-400">—</span>}
                  </td>
                  <td className="px-3 py-2 text-gray-700 text-xs">{c.decisions[0]?.decisionType ?? "—"}</td>
                </tr>
              ))}
              {commsVisiveis.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-gray-400">
                    {aluno.communications.length === 0 ? "Nenhuma comunicação registrada." : "Nenhuma comunicação encontrada com este filtro."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
