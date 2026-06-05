"use client";
import { useTransition } from "react";
import { publicarCaderno } from "../actions";
export default function PublicarBtn({ cadernoId }: { cadernoId: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <button onClick={() => { if (confirm("Confirmar publicação do Caderno Disciplinar?")) startTransition(() => publicarCaderno(cadernoId)); }} disabled={pending} className="btn-primary">
      {pending ? "Publicando..." : "Publicar Caderno"}
    </button>
  );
}
