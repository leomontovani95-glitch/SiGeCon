"use client";
import { useActionState } from "react";
import { excluirCurso } from "../actions";

export default function ExcluirCursoBtn({ id, hasData }: { id: string; hasData: boolean }) {
  const action = excluirCurso.bind(null, id);
  const [state, formAction, pending] = useActionState(action, undefined);

  if (hasData) {
    return <span className="text-xs text-gray-300 cursor-not-allowed" title="Curso possui alunos ou comunicações">Excluir</span>;
  }

  return (
    <form action={formAction} onSubmit={(e) => { if (!confirm("Excluir este curso permanentemente?")) e.preventDefault(); }} className="inline">
      <button type="submit" disabled={pending} className="text-xs text-red-600 hover:underline disabled:opacity-50">
        {pending ? "..." : "Excluir"}
      </button>
      {state?.error && <p className="text-xs text-red-600 mt-1">{state.error}</p>}
    </form>
  );
}
