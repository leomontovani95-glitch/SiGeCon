"use client";
import { useTransition } from "react";
import { adicionarItem } from "../actions";
export default function AdicionarItemBtn({ cadernoId, communicationId }: { cadernoId: string; communicationId: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <button onClick={() => startTransition(() => adicionarItem(cadernoId, communicationId))} disabled={pending} className="text-xs bg-[#1e3a5f] text-white px-3 py-1.5 rounded hover:bg-[#16304f] transition-colors disabled:opacity-50">
      {pending ? "..." : "Adicionar"}
    </button>
  );
}
