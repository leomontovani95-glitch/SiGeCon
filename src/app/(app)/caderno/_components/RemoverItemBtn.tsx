"use client";
import { useState } from "react";
import { removerItemCaderno } from "../actions";

export default function RemoverItemBtn({ cadernoId, itemId }: { cadernoId: string; itemId: string }) {
  const [confirmar, setConfirmar] = useState(false);
  const action = removerItemCaderno.bind(null, cadernoId, itemId);

  if (!confirmar) {
    return (
      <button type="button" onClick={() => setConfirmar(true)} className="text-xs text-red-600 hover:text-red-800 hover:underline">
        Remover
      </button>
    );
  }

  return (
    <form action={action} className="flex items-center gap-1">
      <span className="text-xs text-gray-600">Remover?</span>
      <button type="submit" className="text-xs text-red-700 font-semibold hover:underline">Sim</button>
      <span className="text-xs text-gray-400">/</span>
      <button type="button" onClick={() => setConfirmar(false)} className="text-xs text-gray-500 hover:underline">Não</button>
    </form>
  );
}
