"use client";
import { useTransition } from "react";
import { criarCaderno } from "../actions";

export default function CriarCadernoBtn({ pendentesCount = 0 }: { pendentesCount?: number }) {
  const [pending, startTransition] = useTransition();

  const label = pendentesCount > 0
    ? `Gerar Caderno (${pendentesCount} registro${pendentesCount > 1 ? "s" : ""})`
    : "Gerar Caderno";

  return (
    <button
      onClick={() => {
        if (pendentesCount === 0) {
          alert("Não há registros com decisão pendentes de publicação.");
          return;
        }
        startTransition(() => criarCaderno());
      }}
      disabled={pending || pendentesCount === 0}
      className="bg-[#1e3a5f] text-white px-4 py-2 rounded-lg text-sm hover:bg-[#16304f] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {pending ? "Gerando..." : label}
    </button>
  );
}
