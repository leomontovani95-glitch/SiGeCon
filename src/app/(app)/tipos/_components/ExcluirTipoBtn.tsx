"use client";
import { useActionState } from "react";
import { excluirTipo } from "../actions";

export default function ExcluirTipoBtn({ id }: { id: string }) {
  const [state, formAction] = useActionState(excluirTipo.bind(null, id), undefined);
  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (!confirm("Excluir este tipo de comunicação? Esta ação não pode ser desfeita.")) e.preventDefault();
      }}
      className="inline"
    >
      <button type="submit" className="text-xs text-red-600 hover:underline">Excluir</button>
      {state?.error && <span className="ml-2 text-xs text-red-600">{state.error}</span>}
    </form>
  );
}
