"use client";
import { useState, useRef, useCallback } from "react";

export type AlunoInfo = {
  id: string; warName: string; fullName: string;
  courseNumber: string; course: string; platoon: string | null;
  rg: string; functionalNumber: string | null;
};

// Busca de aluno com lista de sugestões — ao digitar número/nome, aparecem os
// possíveis alunos e o usuário escolhe um (mesmo padrão do comunicante e do
// dispositivo legal). Renderiza o input hidden `studentId` e expõe a seleção
// via `onChange`. Para zerar ao trocar de curso, o pai remonta via `key`.
export default function BuscaAlunoLista({
  courseId,
  enabled,
  onChange,
}: {
  courseId?: string;
  enabled: boolean;
  onChange?: (a: AlunoInfo | null) => void;
}) {
  const [query, setQuery]           = useState("");
  const [resultados, setResultados] = useState<AlunoInfo[]>([]);
  const [aluno, setAluno]           = useState<AlunoInfo | null>(null);
  const [buscando, setBuscando]     = useState(false);
  const [erro, setErro]             = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef    = useRef<AbortController | null>(null);

  const buscar = useCallback(async (q: string) => {
    if (!q.trim()) { setResultados([]); setErro(""); return; }
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setBuscando(true); setErro("");
    try {
      const params = new URLSearchParams({ q: q.trim() });
      if (courseId) params.set("courseId", courseId);
      const res  = await fetch(`/api/alunos/por-numero?${params}`, { signal: ac.signal });
      const data = await res.json();
      const lista: AlunoInfo[] = data.alunos ?? [];
      setResultados(lista);
      setErro(lista.length === 0 ? "Nenhum aluno encontrado." : "");
    } catch (e) {
      if ((e as Error).name === "AbortError") return; // resposta obsoleta, ignora
      setResultados([]); setErro("Erro ao buscar aluno.");
    } finally {
      if (abortRef.current === ac) setBuscando(false);
    }
  }, [courseId]);

  function handleQueryChange(val: string) {
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => buscar(val), 400);
  }
  function selecionar(a: AlunoInfo) {
    setAluno(a); setResultados([]); setQuery(""); setErro("");
    onChange?.(a);
  }
  function limpar() {
    setAluno(null); setResultados([]); setQuery(""); setErro("");
    onChange?.(null);
  }

  return (
    <fieldset className={`border rounded-lg p-4 ${enabled ? "border-blue-200 bg-blue-50" : "border-gray-200 bg-gray-50 opacity-60"}`}>
      <legend className="text-sm font-semibold text-blue-800 px-2">Identificação do Aluno</legend>
      <input type="hidden" name="studentId" value={aluno?.id ?? ""} />

      {!aluno ? (
        <div className="mt-2">
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Número de curso ou nome <span className="text-red-500">*</span>
          </label>
          <input
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            placeholder={enabled ? "Ex: 001, SILVA ou João..." : "Selecione o curso primeiro"}
            disabled={!enabled}
            className="input disabled:cursor-not-allowed"
            autoComplete="off"
          />
          {buscando && <p className="text-xs text-blue-600 mt-1">Buscando...</p>}
          {!buscando && erro && <p className="text-xs text-red-600 mt-1">{erro}</p>}
          {resultados.length > 0 && (
            <ul role="listbox" className="mt-2 border border-gray-200 rounded-lg bg-white divide-y divide-gray-100 max-h-60 overflow-y-auto">
              {resultados.map((a) => (
                <li key={a.id} role="option" aria-selected={false}>
                  <button
                    type="button"
                    onClick={() => selecionar(a)}
                    className="w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-blue-50 focus:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-400"
                  >
                    <span className="inline-block bg-blue-100 text-blue-800 text-xs px-1.5 py-0.5 rounded font-mono whitespace-nowrap">
                      {a.courseNumber}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900 truncate">{a.warName}</p>
                      <p className="text-xs text-gray-500 truncate">
                        {a.fullName} · {a.course}{a.platoon ? ` · ${a.platoon}` : ""}
                      </p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <div className="mt-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div><label className="block text-xs font-medium text-gray-600 mb-1">Nome de guerra</label>
              <p className="input bg-gray-50 font-semibold text-gray-900">{aluno.warName}</p></div>
            <div><label className="block text-xs font-medium text-gray-600 mb-1">Nome completo</label>
              <p className="input bg-gray-50 text-gray-700">{aluno.fullName}</p></div>
            <div><label className="block text-xs font-medium text-gray-600 mb-1">Curso</label>
              <p className="input bg-gray-50 text-gray-700">{aluno.course}</p></div>
            <div><label className="block text-xs font-medium text-gray-600 mb-1">Número de curso</label>
              <p className="input bg-gray-50 text-gray-700">{aluno.courseNumber}</p></div>
            <div><label className="block text-xs font-medium text-gray-600 mb-1">Pelotão</label>
              <p className="input bg-gray-50 text-gray-700">{aluno.platoon ?? "—"}</p></div>
            <div><label className="block text-xs font-medium text-gray-600 mb-1">RG</label>
              <p className="input bg-gray-50 text-gray-700">{aluno.rg}</p></div>
            <div><label className="block text-xs font-medium text-gray-600 mb-1">NF</label>
              <p className="input bg-gray-50 text-gray-700">{aluno.functionalNumber ?? "—"}</p></div>
          </div>
          <button type="button" onClick={limpar} className="mt-3 text-xs text-red-500 hover:text-red-700 font-medium">
            Trocar aluno
          </button>
        </div>
      )}
    </fieldset>
  );
}
