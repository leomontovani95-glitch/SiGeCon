"use client";
import { useActionState } from "react";
import Link from "next/link";
import { salvarPelotao } from "../actions";

type Curso = { id: string; name: string };
type Props = { cursos: Curso[]; defaultValues?: Record<string, string>; id?: string };

export default function PelotaoForm({ cursos, defaultValues, id }: Props) {
  const action = salvarPelotao.bind(null, id ?? null);
  const [state, formAction, pending] = useActionState(action, undefined);
  return (
    <form action={formAction} className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Nome do pelotão *</label>
        <input name="name" defaultValue={defaultValues?.name} required className="input" placeholder="1º Pelotão" />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Curso *</label>
        <select name="courseId" defaultValue={defaultValues?.courseId} required className="input">
          <option value="">Selecione</option>
          {cursos.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
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
        <Link href="/pelotons" className="btn-secondary">Cancelar</Link>
      </div>
    </form>
  );
}
