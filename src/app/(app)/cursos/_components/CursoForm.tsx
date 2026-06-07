"use client";
import { useActionState } from "react";
import { salvarCurso } from "../actions";

type Props = { defaultValues?: Record<string, string>; id?: string };

export default function CursoForm({ defaultValues, id }: Props) {
  const action = salvarCurso.bind(null, id ?? null);
  const [state, formAction, pending] = useActionState(action, undefined);

  return (
    <form action={formAction} className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Nome *</label>
        <input name="name" defaultValue={defaultValues?.name} required className="input" placeholder="CFO 1" />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Sigla *</label>
        <input name="acronym" defaultValue={defaultValues?.acronym} required className="input" placeholder="CFO1" />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Escola *</label>
        <select name="school" defaultValue={defaultValues?.school ?? ""} required className="input">
          <option value="" disabled>Selecione</option>
          <option value="ESFAP">EsFAP (CHS / CFSd)</option>
          <option value="ESFO">EsFO (CFO)</option>
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Ano</label>
        <input name="year" type="number" defaultValue={defaultValues?.year} className="input" placeholder="2026" />
      </div>
      {!id && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Quantidade de Pelotões</label>
          <input name="platoonCount" type="number" min="0" defaultValue="0" className="input" placeholder="0" />
          <p className="text-xs text-gray-400 mt-1">Pelotões serão criados automaticamente de 1º ao Nº informado.</p>
        </div>
      )}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Descrição</label>
        <input name="description" defaultValue={defaultValues?.description} className="input" />
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
        <a href="/cursos" className="btn-secondary">Cancelar</a>
      </div>
    </form>
  );
}
