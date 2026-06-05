"use client";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

type Props = { page: number; totalPages: number };

export default function Pagination({ page, totalPages }: Props) {
  const pathname = usePathname();
  const params = useSearchParams();

  if (totalPages <= 1) return null;

  function href(p: number) {
    const next = new URLSearchParams(params.toString());
    next.set("page", String(p));
    return `${pathname}?${next.toString()}`;
  }

  // Gera janela de páginas: sempre mostra primeira, última e ±2 em torno da atual
  const pages: (number | "…")[] = [];
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= page - 2 && i <= page + 2)) {
      pages.push(i);
    } else if (pages.at(-1) !== "…") {
      pages.push("…");
    }
  }

  return (
    <div className="flex items-center justify-center gap-1 py-4">
      <Link
        href={href(page - 1)}
        aria-disabled={page <= 1}
        className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
          page <= 1 ? "pointer-events-none text-gray-300" : "text-gray-600 hover:bg-gray-100"
        }`}
      >
        ← Anterior
      </Link>

      {pages.map((p, i) =>
        p === "…" ? (
          <span key={`ellipsis-${i}`} className="px-2 text-gray-400 text-sm select-none">…</span>
        ) : (
          <Link
            key={p}
            href={href(p)}
            className={`w-8 h-8 flex items-center justify-center rounded-lg text-sm transition-colors ${
              p === page
                ? "bg-[#1e3a5f] text-white font-semibold"
                : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            {p}
          </Link>
        )
      )}

      <Link
        href={href(page + 1)}
        aria-disabled={page >= totalPages}
        className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
          page >= totalPages ? "pointer-events-none text-gray-300" : "text-gray-600 hover:bg-gray-100"
        }`}
      >
        Próxima →
      </Link>
    </div>
  );
}
