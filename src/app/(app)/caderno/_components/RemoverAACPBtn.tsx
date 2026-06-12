"use client";
import { useTransition } from "react";
import { removerAACP } from "../aacp-actions";

export default function RemoverAACPBtn({ aacpId }: { aacpId: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => {
        if (!confirm("Deseja remover a AACP deste caderno?")) return;
        startTransition(() => removerAACP(aacpId));
      }}
      className="text-xs text-red-500 hover:text-red-700 hover:underline disabled:opacity-50"
    >
      {isPending ? "Removendo…" : "Remover AACP"}
    </button>
  );
}
