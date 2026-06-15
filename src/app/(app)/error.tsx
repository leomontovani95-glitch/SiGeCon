"use client";
import { useEffect } from "react";
import { logger } from "@/lib/logger";

// Error boundary da área autenticada: substitui a tela de erro genérica do Next
// por uma mensagem amigável com botão de "Tentar novamente".
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    logger.error("error boundary (app)", error, { digest: error.digest });
  }, [error]);

  return (
    <div className="p-6">
      <div className="mx-auto mt-10 max-w-md rounded-xl border border-red-200 bg-red-50 p-6 text-center">
        <p className="mb-2 text-3xl">⚠️</p>
        <h2 className="mb-1 text-lg font-semibold text-red-900">Algo deu errado</h2>
        <p className="mb-4 text-sm text-red-700">
          Não foi possível carregar esta página. Você pode tentar novamente.
        </p>
        <div className="flex justify-center gap-3">
          <button onClick={() => reset()} className="btn-primary text-sm">
            Tentar novamente
          </button>
          <a href="/dashboard" className="btn-secondary text-sm">
            Ir ao Painel
          </a>
        </div>
      </div>
    </div>
  );
}
