"use client";
import { useActionState } from "react";
import { salvarRegra } from "../actions";

const TIPOS = ["CPI 0", "CPI 1", "CPI 2", "CPI 3", "Referência Elogiosa", "Elogio publicado em BI", "Arquivamento"];

type Props = { defaultValues?: Record<string, string>; id?: string };

export default function RegraForm({ defaultValues, id }: Props) {
  const action = salvarRegra.bind(null, id ?? null);
  const [state, formAction, pending] = useActionState(action, undefined);
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
          <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de comunicação sugerido</label>
          <select name="defaultCommunicationType" defaultValue={defaultValues?.defaultCommunicationType ?? ""} className="input">
            <option value="">Selecione</option>
            {TIPOS.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Pontuação padrão</label>
          <input name="defaultScore" type="number" step="0.1" defaultValue={defaultValues?.defaultScore} className="input" placeholder="0.1" />
        </div>
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
        <a href="/manual" className="btn-secondary">Cancelar</a>
      </div>
    </form>
  );
}
