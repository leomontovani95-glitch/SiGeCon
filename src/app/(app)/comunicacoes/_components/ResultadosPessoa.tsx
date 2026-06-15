"use client";

// Lista de resultados de busca de pessoa (comunicante/testemunha), reutilizável.
// Cada item é um <button> — acessível por teclado (Tab/Enter) e leitor de tela —
// em vez de um <li onClick> (que não era navegável por teclado).
export type ResultadoPessoa = {
  key: string;
  rank: string;
  name: string;
  fullName: string;
  detail: string;
  tipo: "Usuário" | "Aluno";
};

// Genérico: usa só os campos de ResultadoPessoa para renderizar, mas repassa o
// objeto completo (ex.: CommResult, que tem userId) ao onSelecionar.
export default function ResultadosPessoa<T extends ResultadoPessoa>({
  results,
  onSelecionar,
}: {
  results: T[];
  onSelecionar: (r: T) => void;
}) {
  if (results.length === 0) return null;
  return (
    <ul role="listbox" className="border border-gray-200 rounded-lg bg-white divide-y divide-gray-100 max-h-48 overflow-y-auto">
      {results.map((r) => (
        <li key={r.key} role="option" aria-selected={false}>
          <button
            type="button"
            onClick={() => onSelecionar(r)}
            className="w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-blue-50 focus:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-400"
          >
            <span className="inline-block bg-gray-100 text-gray-600 text-xs px-1.5 py-0.5 rounded font-mono whitespace-nowrap">
              {r.rank || "—"}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-gray-900 truncate">{r.name}</p>
              <p className="text-xs text-gray-500 truncate">{r.fullName} · {r.detail}</p>
            </div>
            <span className={`text-xs px-1.5 py-0.5 rounded-full whitespace-nowrap ${
              r.tipo === "Usuário" ? "bg-indigo-100 text-indigo-700" : "bg-blue-100 text-blue-700"
            }`}>{r.tipo}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
