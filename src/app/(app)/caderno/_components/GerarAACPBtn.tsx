"use client";
import { useTransition } from "react";
import { criarAACP } from "../aacp-actions";

export default function GerarAACPBtn({ cadernoId }: { cadernoId: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => startTransition(() => criarAACP(cadernoId))}
      className="btn-primary text-sm disabled:opacity-50"
    >
      {isPending ? "Gerando…" : "Gerar AACP"}
    </button>
  );
}
