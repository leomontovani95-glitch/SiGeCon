"use client";
import { useState } from "react";
import { publicarCaderno } from "../actions";

export default function PublicarBtn({ cadernoId }: { cadernoId: string }) {
  const [confirmar, setConfirmar] = useState(false);
  const action = publicarCaderno.bind(null, cadernoId);

  if (!confirmar) {
    return (
      <button type="button" onClick={() => setConfirmar(true)} className="btn-primary">
        Publicar Caderno
      </button>
    );
  }

  return (
    <form action={action} className="flex items-center gap-2 flex-wrap">
      <span className="text-sm text-gray-700 font-medium">Confirmar publicação?</span>
      <button type="submit" className="btn-primary">Sim, publicar</button>
      <button type="button" onClick={() => setConfirmar(false)} className="btn-secondary">Cancelar</button>
    </form>
  );
}
