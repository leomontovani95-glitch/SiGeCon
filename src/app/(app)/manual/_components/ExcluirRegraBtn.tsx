"use client";
import { useActionState } from "react";
import { excluirRegra } from "../actions";

export default function ExcluirRegraBtn({ id }: { id: string }) {
  const [state, formAction] = useActionState(excluirRegra.bind(null, id), undefined);
  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (!confirm("Excluir este dispositivo legal? Esta ação não pode ser desfeita.")) e.preventDefault();
      }}
      className="inline"
    >
      <button type="submit" className="text-xs text-red-600 hover:underline">Excluir</button>
      {state?.error && <span className="ml-2 text-xs text-red-600">{state.error}</span>}
    </form>
  );
}
