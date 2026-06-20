"use client";
import { useActionState, useState } from "react";
import { alterarDecisao } from "../actions";
import { pontuacaoAutomatica } from "@/lib/pontuacao";

type ManualRule = { id: string; article: string; item: string | null; letter: string | null; description: string; defaultCommunicationType: string | null; halfCpi1: boolean };
type Tipo = { name: string; score: number };

type Props = {
  communicationId: string;
  protocolo: string;
  recordType: string;
  isElogiosa: boolean;
  currentDecision: string;
  currentText: string;
  currentObservation: string;
  currentScore: number | null;
  typeScore: number;
  halfCpi1: boolean;
  tipos: Tipo[];
  manualRules: ManualRule[];
};

export default function AlterarDecisaoBtn({
  communicationId, protocolo, recordType, isElogiosa,
  currentDecision, currentText, currentObservation, currentScore, typeScore, halfCpi1, tipos, manualRules,
}: Props) {
  const [aberto, setAberto] = useState(false);
  const [state, formAction, pending] = useActionState(alterarDecisao, undefined);

  const [decisao, setDecisao] = useState(currentDecision);
  const [novoRuleId, setNovoRuleId] = useState("");

  // Pontuação padrão (Tipos de Comunicação), conforme a decisão/enquadramento.
  const padraoPontuacao = (tipo: string, ruleId: string): number | null => {
    if (tipo === "Arquivamento") return 0;
    if (tipo === "Reenquadrar artigo") {
      const r = manualRules.find((x) => x.id === ruleId);
      if (!r) return null;
      const ts = r.defaultCommunicationType
        ? tipos.find((t) => t.name === r.defaultCommunicationType)?.score ?? typeScore
        : typeScore;
      return pontuacaoAutomatica(ts, r.halfCpi1);
    }
    return pontuacaoAutomatica(typeScore, halfCpi1); // Punição / Homologação
  };

  const padraoInicial = padraoPontuacao(currentDecision, "");
  const [pontos, setPontos] = useState(currentScore != null ? String(currentScore) : "");
  const [pontosManual, setPontosManual] = useState(
    padraoInicial != null && currentScore != null && currentScore !== padraoInicial,
  );

  function aplicarPadrao(tipo: string, ruleId: string) {
    const p = padraoPontuacao(tipo, ruleId);
    setPontos(p != null ? String(p) : "");
    setPontosManual(false);
  }

  const padraoAtual = padraoPontuacao(decisao, novoRuleId);
  const mostrarPontos = !!decisao && decisao !== "Arquivamento" && padraoAtual != null;

  const opcoes = isElogiosa
    ? ["Homologação (Referência Elogiosa)", "Arquivamento"]
    : ["Punição", "Arquivamento", "Reenquadrar artigo"];

  if (!aberto) {
    return (
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="text-xs font-semibold text-amber-700 hover:text-amber-900 hover:underline"
      >
        Alterar decisão →
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => !pending && setAberto(false)}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-gray-900">Alterar decisão</h3>
            <p className="text-xs text-gray-500 font-mono mt-0.5">{protocolo} · {recordType}</p>
          </div>
          <button type="button" onClick={() => setAberto(false)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>

        <form action={formAction} className="p-5 space-y-4">
          <input type="hidden" name="communicationId" value={communicationId} />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Decisão <span className="text-red-500">*</span></label>
            <select
              name="decisionType"
              required
              value={decisao}
              onChange={(e) => {
                const v = e.target.value;
                setDecisao(v);
                if (v !== "Reenquadrar artigo") { setNovoRuleId(""); aplicarPadrao(v, ""); }
                else { setNovoRuleId(""); }
              }}
              className="input"
            >
              <option value="">Selecione</option>
              {opcoes.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>

          {decisao === "Reenquadrar artigo" && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Novo artigo do Manual <span className="text-red-500">*</span></label>
              <select
                name="newManualRuleId"
                required
                value={novoRuleId}
                onChange={(e) => { setNovoRuleId(e.target.value); aplicarPadrao("Reenquadrar artigo", e.target.value); }}
                className="input"
              >
                <option value="">Selecione o artigo</option>
                {manualRules.map((r) => (
                  <option key={r.id} value={r.id}>
                    Art. {r.article}{r.item ? ` — Inc. ${r.item}` : ""}{r.letter ? ` — Al. ${r.letter}` : ""} — {r.description}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Fundamentação <span className="text-red-500">*</span></label>
            <textarea name="text" required rows={4} defaultValue={currentText} className="input" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Observação para o caderno disciplinar <span className="text-gray-400 font-normal">(opcional)</span>
            </label>
            <textarea
              name="commanderObservation"
              rows={2}
              defaultValue={currentObservation}
              placeholder="Aparece na coluna Observação do caderno, além das observações automáticas."
              className="input"
            />
          </div>

          {/* Pontuação: padrão de Tipos de Comunicação, editável pelo Comandante. */}
          {decisao === "Arquivamento" ? (
            <p className="text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
              Arquivamento não desconta nem acresce a nota de conduta.
            </p>
          ) : mostrarPontos ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Pontuação final <span className="text-red-500">*</span></label>
              <input
                name="finalScore"
                type="number"
                step="0.1"
                min="0"
                value={pontos}
                onChange={(e) => { setPontos(e.target.value); setPontosManual(padraoAtual != null && parseFloat(e.target.value) !== padraoAtual); }}
                className="input max-w-xs"
              />
              {pontosManual ? (
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mt-1">
                  ⚠ Pontuação alterada do padrão ({padraoAtual?.toFixed(1)} pt, definido em Tipos de Comunicação) para {pontos || "—"} pt. Use quando o regulamento vigente para o curso exigir valor diferente.
                </p>
              ) : (
                <p className="text-xs text-gray-400 mt-1">
                  Padrão (Tipos de Comunicação): {padraoAtual?.toFixed(1)} pt — pode ser alterado conforme o regulamento vigente para o curso.
                </p>
              )}
            </div>
          ) : (
            <p className="text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
              Selecione o novo artigo para calcular a pontuação padrão.
            </p>
          )}

          <p className="text-xs text-gray-500">
            A alteração reflete no caderno rascunho e, após a publicação, na nota do aluno.
          </p>

          {state?.error && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">{state.error}</div>
          )}

          <div className="flex gap-2 pt-1">
            <button type="submit" disabled={pending} className="btn-primary disabled:opacity-50">
              {pending ? "Salvando..." : "Salvar decisão"}
            </button>
            <button type="button" onClick={() => setAberto(false)} className="btn-secondary">Cancelar</button>
          </div>
        </form>
      </div>
    </div>
  );
}
