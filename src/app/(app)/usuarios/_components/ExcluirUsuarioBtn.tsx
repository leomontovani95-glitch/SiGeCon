"use client";
import { useActionState } from "react";
import { excluirUsuario } from "../actions";

export default function ExcluirUsuarioBtn({ id, canDelete = true }: { id: string; canDelete?: boolean }) {
  const action = excluirUsuario.bind(null, id);
  const [state, formAction, pending] = useActionState(action, undefined);

  if (!canDelete) {
    return <span className="text-xs text-gray-300 cursor-not-allowed" title="Sem permissão para excluir este usuário">Excluir</span>;
  }

  return (
    <form action={formAction} onSubmit={(e) => { if (!confirm("Excluir este usuário permanentemente?")) e.preventDefault(); }} className="inline">
      <button type="submit" disabled={pending} className="text-xs text-red-600 hover:underline disabled:opacity-50">
        {pending ? "..." : "Excluir"}
      </button>
      {state?.error && <p className="text-xs text-red-600 mt-1">{state.error}</p>}
    </form>
  );
}
