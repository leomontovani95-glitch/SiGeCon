"use client";
import { useActionState, useState } from "react";
import Link from "next/link";
import { salvarRegra } from "../actions";

// Pontuação padrão de cada tipo (pré-seleciona a caixa de pontuação; editável).
const TIPO_SCORE: Record<string, number> = {
  "CPI 1": 0.2,
  "CPI 2": 0.4,
  "CPI 3": 0.6,
  "Referência Elogiosa": 0.2,
  "Elogio publicado em BI": 1,
  "TD Leve": 1,
  "TD Média": 2,
  "TD Grave": 3,
  "TAC": 0,
  "Arquivamento": 0,
};
const TIPOS = Object.keys(TIPO_SCORE);

type Props = { defaultValues?: Record<string, string>; id?: string };

export default function RegraForm({ defaultValues, id }: Props) {
  const action = salvarRegra.bind(null, id ?? null);
  const [state, formAction, pending] = useActionState(action, undefined);

  const [tipo, setTipo] = useState(defaultValues?.defaultCommunicationType ?? "");
  const [score, setScore] = useState(defaultValues?.defaultScore ?? "");
  // "50% da pont. da CPI 1": padrão Não. Quando Sim, o dispositivo é tratado
  // como CPI 1 valendo metade da pontuação (na CPI e na observação do caderno).
  const [metade, setMetade] = useState(defaultValues?.halfCpi1 === "true");

  // Pontuação efetiva exibida para um tipo, considerando o "50% da CPI 1".
  function pontuacaoPara(t: string, ehMetade: boolean): string {
    if (!(t in TIPO_SCORE)) return "";
    const base = TIPO_SCORE[t];
    const val = ehMetade ? base / 2 : base;
    return String(Math.round(val * 100) / 100);
  }

  // Ao escolher o tipo, pré-preenche a pontuação com o valor padrão dele
  // (metade se "50% da CPI 1" = Sim) — mas o campo continua editável.
  function onTipoChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const t = e.target.value;
    setTipo(t);
    const p = pontuacaoPara(t, metade);
    if (p !== "") setScore(p);
  }

  // Ao alternar o "50% da CPI 1", reflete na pontuação exibida (se houver tipo).
  function onMetadeChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const novo = e.target.value === "true";
    setMetade(novo);
    const p = pontuacaoPara(tipo, novo);
    if (p !== "") setScore(p);
  }

  return (
    <form action={formAction} className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Artigo *</label>
          <input name="article" defaultValue={defaultValues?.article} required className="input" placeholder="146" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Inciso</label>
          <input name="item" defaultValue={defaultValues?.item} className="input" placeholder="I" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Alínea</label>
          <input name="letter" defaultValue={defaultValues?.letter} className="input" placeholder="a" />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Tema / Categoria</label>
        <input name="theme" defaultValue={defaultValues?.theme} className="input" placeholder="Ex: Símbolos, uniformes, insígnias e apresentação pessoal" />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Descrição da conduta *</label>
        <textarea name="description" defaultValue={defaultValues?.description} required rows={3} className="input" placeholder="Fardamento em desalinho" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Tipo de comunicação sugerido <span className="text-red-500">*</span>
          </label>
          <select name="defaultCommunicationType" value={tipo} onChange={onTipoChange} required className="input">
            <option value="">Selecione</option>
            {TIPOS.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <p className="text-xs text-gray-500 mt-1">
            Obrigatório — define em qual tela o dispositivo aparece (CPI, Referência, etc.) e a pontuação automática.
          </p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Pontuação do dispositivo</label>
          <input
            name="defaultScore"
            type="number"
            step="0.1"
            min="0"
            value={score}
            onChange={(e) => setScore(e.target.value)}
            className="input"
            placeholder="0.2"
          />
          <p className="text-xs text-gray-500 mt-1">
            Pré-preenchida pelo tipo; ajuste para um artigo específico se a legislação exigir (ex.: Art. 146, I, a/b → 0,1).
          </p>
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">50% da pont. da CPI 1</label>
        <select name="halfCpi1" value={metade ? "true" : "false"} onChange={onMetadeChange} className="input max-w-xs">
          <option value="false">Não</option>
          <option value="true">Sim</option>
        </select>
        <p className="text-xs text-gray-500 mt-1">
          {metade
            ? "Sim — o dispositivo é uma CPI 1, mas vale 50% da pontuação. O aviso de CPI 1 continua aparecendo na confecção da CPI e a observação “50% da pont. de CPI 1” é incluída no caderno disciplinar."
            : "Não (padrão) — a pontuação segue o tipo de comunicação cadastrado. Use “Sim” para artigos que valem metade da CPI 1 (ex.: Art. 146, I, a/b)."}
        </p>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Situação</label>
        <select name="active" defaultValue={defaultValues?.active ?? "true"} className="input">
          <option value="true">Ativo</option>
          <option value="false">Inativo</option>
        </select>
      </div>
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      <div className="flex gap-3 pt-2">
        <button type="submit" disabled={pending} className="btn-primary">{pending ? "Salvando..." : "Salvar"}</button>
        <Link href="/manual" className="btn-secondary">Cancelar</Link>
      </div>
    </form>
  );
}
