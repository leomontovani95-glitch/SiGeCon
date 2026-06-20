"use client";
import { useActionState, useState } from "react";
import { alterarDecisao } from "../actions";

type ManualRule = { id: string; article: string; item: string | null; letter: string | null; description: string };

type Props = {
  communicationId: string;
  protocolo: string;
  recordType: string;
  isElogiosa: boolean;
  currentDecision: string;
  currentText: string;
  currentObservation: string;
  manualRules: ManualRule[];
};

export default function AlterarDecisaoBtn({
  communicationId, protocolo, recordType, isElogiosa,
  currentDecision, currentText, currentObservation, manualRules,
}: Props) {
  const [aberto, setAberto] = useState(false);
  const [state, formAction, pending] = useActionState(alterarDecisao, undefined);

  const [decisao, setDecisao] = useState(currentDecision);
  const [novoRuleId, setNovoRuleId] = useState("");

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
              onChange={(e) => { setDecisao(e.target.value); if (e.target.value !== "Reenquadrar artigo") setNovoRuleId(""); }}
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
                onChange={(e) => setNovoRuleId(e.target.value)}
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

          <p className="text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
            A pontuação é automática (conforme o tipo / novo enquadramento). A alteração reflete no caderno
            rascunho e, após a publicação, na nota do aluno.
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
