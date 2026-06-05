"use client";
import { useActionState } from "react";
import { salvarTipo } from "../actions";
type Props = { defaultValues?: Record<string, string>; id?: string };
export default function TipoForm({ defaultValues, id }: Props) {
  const action = salvarTipo.bind(null, id ?? null);
  const [state, formAction, pending] = useActionState(action, undefined);
  return (
    <form action={formAction} className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
      <div><label className="block text-sm font-medium text-gray-700 mb-1">Nome *</label><input name="name" defaultValue={defaultValues?.name} required className="input" /></div>
      <div><label className="block text-sm font-medium text-gray-700 mb-1">Descrição</label><input name="description" defaultValue={defaultValues?.description} className="input" /></div>
      <div className="grid grid-cols-2 gap-4">
        <div><label className="block text-sm font-medium text-gray-700 mb-1">Pontuação *</label><input name="score" type="number" step="0.1" defaultValue={defaultValues?.score} required className="input" /></div>
        <div><label className="block text-sm font-medium text-gray-700 mb-1">Natureza *</label>
          <select name="scoreNature" defaultValue={defaultValues?.scoreNature ?? "DESFAVORAVEL"} className="input">
            <option value="DESFAVORAVEL">Desfavorável</option>
            <option value="FAVORAVEL">Favorável</option>
          </select>
        </div>
      </div>
      <div><label className="block text-sm font-medium text-gray-700 mb-1">Situação</label>
        <select name="active" defaultValue={defaultValues?.active ?? "true"} className="input">
          <option value="true">Ativo</option><option value="false">Inativo</option>
        </select>
      </div>
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      <div className="flex gap-3 pt-2">
        <button type="submit" disabled={pending} className="btn-primary">{pending ? "Salvando..." : "Salvar"}</button>
        <a href="/tipos" className="btn-secondary">Cancelar</a>
      </div>
    </form>
  );
}
