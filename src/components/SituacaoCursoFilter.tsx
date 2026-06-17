import Link from "next/link";

// Segmented control "Situação do curso" (Ativos / Inativos / Todos) usado nas
// abas de busca. Recebe a lista de opções já com href montado pela página.
export default function SituacaoCursoFilter({
  options,
}: {
  options: { key: string; label: string; href: string; active: boolean }[];
}) {
  return (
    <div>
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Situação do curso</p>
      <div className="flex gap-2">
        {options.map((o) => (
          <Link
            key={o.key}
            href={o.href}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              o.active ? "bg-[#1e3a5f] text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            {o.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
