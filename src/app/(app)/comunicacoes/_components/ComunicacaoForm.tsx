"use client";
import { useActionState, useState, useRef, useCallback, useMemo } from "react";

const POSTOS = [
  "CEL", "TEN CEL", "MAJ", "CAP", "1º TEN", "2º TEN", "ASP OF",
  "AL OF 1º ANO", "AL OF 2º ANO", "AL OF 3º ANO",
  "SUBTEN", "1º SGT", "2º SGT", "3º SGT", "CB", "SD", "AL SD",
  "OUTRO (CIVIL)",
];
import { registrarComunicacao } from "../actions";
import { dataLocalISO } from "@/lib/utils";

type Tipo  = { id: string; name: string; score: number };
type Regra = {
  id: string; article: string; item: string | null; letter: string | null;
  description: string; theme: string | null;
  defaultCommunicationType: string | null; defaultScore: number | null;
};
type AlunoInfo = {
  id: string; warName: string; fullName: string;
  courseNumber: string; course: string; platoon: string | null;
  rg: string; functionalNumber: string | null;
};
type Curso = { id: string; name: string };
type CommResult = {
  key: string; userId: string; rank: string; name: string; fullName: string;
  detail: string; tipo: "Usuário" | "Aluno";
};

type ComunicanteFixo = {
  userId: string;
  rank: string;
  name: string;
  fullName: string;
  detail: string;
};

type Props = { tipos: Tipo[]; regras: Regra[]; cursos?: Curso[]; comunicanteFixo?: ComunicanteFixo };

// ── helpers de cascata ────────────────────────────────────────────────────
function artigos(regras: Regra[]) {
  const seen = new Set<string>();
  return regras
    .filter((r) => { const k = r.article; if (seen.has(k)) return false; seen.add(k); return true; })
    .sort((a, b) => parseInt(a.article) - parseInt(b.article))
    .map((r) => ({ article: r.article, theme: r.theme ?? "" }));
}

function incisos(regras: Regra[], article: string) {
  const seen = new Set<string>();
  return regras
    .filter((r) => r.article === article && r.item)
    .filter((r) => { const k = r.item!; if (seen.has(k)) return false; seen.add(k); return true; })
    .sort((a, b) => {
      const ord: Record<string, number> = { I: 1, II: 2, III: 3, IV: 4, V: 5 };
      return (ord[a.item!] ?? 99) - (ord[b.item!] ?? 99);
    })
    .map((r) => r.item!);
}

function alineas(regras: Regra[], article: string, item: string) {
  return regras
    .filter((r) => r.article === article && r.item === item)
    .sort((a, b) => (a.letter ?? "").localeCompare(b.letter ?? ""));
}

// ── sub-componente de testemunha ──────────────────────────────────────────
function TestemunhaRow({ idx, onRemove }: { idx: number; onRemove: () => void }) {
  const [mode, setMode] = useState<"buscar" | "manual">("buscar");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CommResult[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [selected, setSelected] = useState<CommResult | null>(null);
  const [rank, setRank] = useState("");
  const [name, setName] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [buscaErro, setBuscaErro] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  async function buscar(q: string) {
    if (q.length < 2) { setResults([]); setBuscaErro(""); return; }
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setBuscando(true); setBuscaErro("");
    try {
      const res = await fetch(`/api/comunicante/buscar?q=${encodeURIComponent(q)}`, { signal: ac.signal });
      const data = await res.json();
      setResults(data.results ?? []);
    } catch (e) {
      if ((e as Error).name === "AbortError") return; // resposta obsoleta, ignora
      setResults([]); setBuscaErro("Erro ao buscar. Tente novamente.");
    } finally {
      if (abortRef.current === ac) setBuscando(false);
    }
  }

  function handleQueryChange(val: string) {
    setQuery(val); setSelected(null); setResults([]); setBuscaErro("");
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => buscar(val), 400);
  }

  function selecionar(r: CommResult) {
    setSelected(r); setRank(r.rank); setName(r.name);
    setResults([]); setQuery("");
  }

  function limpar() { setSelected(null); setRank(""); setName(""); }

  function trocarModo(m: "buscar" | "manual") { setMode(m); limpar(); }

  return (
    <div className="border border-gray-200 rounded-lg p-3 bg-white space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-gray-600">Testemunha {idx + 1}</span>
        <button type="button" onClick={onRemove} className="text-red-400 hover:text-red-600 text-xs font-medium">
          Remover
        </button>
      </div>

      <div className="flex gap-1">
        {(["buscar", "manual"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => trocarModo(m)}
            className={`text-xs font-medium px-3 py-1.5 rounded-md transition-colors ${
              mode === m ? "bg-[#1e3a5f] text-white" : "bg-white border border-gray-300 text-gray-600 hover:bg-gray-100"
            }`}
          >
            {m === "buscar" ? "Buscar cadastrado" : "Preencher manualmente"}
          </button>
        ))}
      </div>

      {mode === "buscar" && (
        <>
          <input type="hidden" name="witnessRank" value={rank} />
          <input type="hidden" name="witnessName" value={name} />
          {!selected ? (
            <div className="space-y-1">
              <input
                value={query}
                onChange={(e) => handleQueryChange(e.target.value)}
                placeholder="Pesquise por nome, RG ou NF..."
                className="input text-sm"
                autoComplete="off"
              />
              {buscando && <p className="text-xs text-blue-600">Buscando...</p>}
              {buscaErro && <p className="text-xs text-red-600">{buscaErro}</p>}
              {!buscando && !buscaErro && query.length >= 2 && results.length === 0 && (
                <p className="text-xs text-gray-400">Nenhum resultado. Use &quot;Preencher manualmente&quot;.</p>
              )}
              {results.length > 0 && (
                <ul className="border border-gray-200 rounded-lg bg-white divide-y divide-gray-100 max-h-40 overflow-y-auto">
                  {results.map((r) => (
                    <li
                      key={r.key}
                      onClick={() => selecionar(r)}
                      className="px-3 py-2 hover:bg-blue-50 cursor-pointer flex items-center gap-2"
                    >
                      <span className="bg-gray-100 text-gray-600 text-xs px-1.5 py-0.5 rounded font-mono whitespace-nowrap">
                        {r.rank || "—"}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-900 truncate">{r.name}</p>
                        <p className="text-xs text-gray-500 truncate">{r.fullName} · {r.detail}</p>
                      </div>
                      <span className={`text-xs px-1.5 py-0.5 rounded-full whitespace-nowrap ${
                        r.tipo === "Usuário" ? "bg-indigo-100 text-indigo-700" : "bg-blue-100 text-blue-700"
                      }`}>{r.tipo}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-3 bg-white border border-green-200 rounded-lg px-3 py-2">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900">
                  {rank && <span className="font-mono text-xs bg-gray-100 px-1 mr-1.5 rounded">{rank}</span>}
                  {name}
                </p>
                <p className="text-xs text-gray-500 truncate">{selected.fullName} · {selected.detail}</p>
              </div>
              <span className={`text-xs px-1.5 py-0.5 rounded-full whitespace-nowrap ${
                selected.tipo === "Usuário" ? "bg-indigo-100 text-indigo-700" : "bg-blue-100 text-blue-700"
              }`}>{selected.tipo}</span>
              <button type="button" onClick={limpar} className="text-xs text-red-500 hover:text-red-700 font-medium whitespace-nowrap">
                Alterar
              </button>
            </div>
          )}
        </>
      )}

      {mode === "manual" && (
        <div className="grid grid-cols-1 sm:grid-cols-[180px_1fr] gap-2">
          <select
            name="witnessRank"
            value={rank}
            onChange={(e) => setRank(e.target.value)}
            className="input text-sm"
          >
            <option value="">Posto/Graduação</option>
            {POSTOS.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
          <input
            name="witnessName"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nome completo ou de guerra"
            className="input text-sm"
          />
        </div>
      )}
    </div>
  );
}

// ── componente ────────────────────────────────────────────────────────────
export default function ComunicacaoForm({ tipos, regras, cursos, comunicanteFixo }: Props) {
  const [state, formAction, pending] = useActionState(registrarComunicacao, undefined);

  // Curso selecionado (quando lista é fornecida)
  const [cursoSelecionadoId, setCursoSelecionadoId] = useState("");

  // Aluno
  const [numCurso, setNumCurso] = useState("");
  const [aluno, setAluno] = useState<AlunoInfo | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [erroAluno, setErroAluno] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const alunoAbortRef = useRef<AbortController | null>(null);

  // Comunicante
  const commDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [commTab, setCommTab] = useState<"buscar" | "manual">("buscar");
  const [commQuery, setCommQuery] = useState("");
  const [commResults, setCommResults] = useState<CommResult[]>([]);
  const [commBuscando, setCommBuscando] = useState(false);
  const [commErro, setCommErro] = useState("");
  const commAbortRef = useRef<AbortController | null>(null);
  const [commSelecionado, setCommSelecionado] = useState<CommResult | null>(null);
  const [commRank, setCommRank] = useState(comunicanteFixo?.rank ?? "");
  const [commName, setCommName] = useState(comunicanteFixo?.name ?? "");
  const [commUserId, setCommUserId] = useState(comunicanteFixo?.userId ?? "");

  // Dispositivo legal — auto-preenchido quando há uma única regra possível
  const regraAutoFill = regras.length === 1 ? regras[0] : null;
  const [artigo, setArtigo] = useState(() => {
    const arts = [...new Set(regras.map((r) => r.article))];
    return arts.length === 1 ? arts[0] : "";
  });
  const [inciso, setInciso] = useState(() => {
    const arts = [...new Set(regras.map((r) => r.article))];
    if (arts.length !== 1) return "";
    const items = [...new Set(regras.filter((r) => r.article === arts[0]).map((r) => r.item).filter(Boolean))];
    return items.length === 1 ? (items[0] as string) : "";
  });
  const [ruleId, setRuleId] = useState(() => (regras.length === 1 ? regras[0].id : ""));

  // Tipo e pontuação (controlados para auto-fill)
  const [typeId, setTypeId] = useState(() => {
    if (!regraAutoFill?.defaultCommunicationType) return "";
    return tipos.find((t) => t.name === regraAutoFill.defaultCommunicationType)?.id ?? "";
  });
  const [score, setScore] = useState(() => {
    const t = regraAutoFill?.defaultCommunicationType
      ? tipos.find((x) => x.name === regraAutoFill.defaultCommunicationType)
      : undefined;
    return t ? String(t.score) : "";
  });

  // Período de Adaptação
  const [adaptationPeriod, setAdaptationPeriod] = useState(false);

  // Testemunhas
  const [testemunhaKeys, setTestemunhaKeys] = useState<number[]>([]);
  const keyCountRef = useRef(0);
  function addTestemunha() { setTestemunhaKeys((k) => [...k, keyCountRef.current++]); }
  function removeTestemunha(key: number) { setTestemunhaKeys((k) => k.filter((x) => x !== key)); }

  // Anexos (meios de prova)
  const [arquivos, setArquivos] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  function removerArquivo(idx: number) {
    const dt = new DataTransfer();
    arquivos.forEach((f, i) => { if (i !== idx) dt.items.add(f); });
    if (fileInputRef.current) fileInputRef.current.files = dt.files;
    setArquivos(Array.from(dt.files));
  }

  // Lookup: nome do tipo → id
  const tipoByName = useMemo(
    () => Object.fromEntries(tipos.map((t) => [t.name, t.id])),
    [tipos]
  );

  const listaArtigos  = useMemo(() => artigos(regras), [regras]);
  const listaIncisos  = useMemo(() => incisos(regras, artigo), [regras, artigo]);
  const listaAlineas  = useMemo(() => alineas(regras, artigo, inciso), [regras, artigo, inciso]);
  const regraAtual    = useMemo(() => regras.find((r) => r.id === ruleId) ?? null, [regras, ruleId]);

  // ── auto-fill ao selecionar alínea ───────────────────────────────────
  function selecionarRegra(r: Regra) {
    setRuleId(r.id);
    // Pontuação sugerida vem do score do tipo (CommunicationType) — fonte única,
    // editável em /tipos. Assim novas comunicações seguem a legislação vigente.
    if (r.defaultCommunicationType) {
      const tipo = tipos.find((t) => t.name === r.defaultCommunicationType);
      if (tipo) { setTypeId(tipo.id); setScore(String(tipo.score)); }
    }
  }

  // ── reset em cascata ─────────────────────────────────────────────────
  function handleArtigoChange(val: string) {
    setArtigo(val); setInciso(""); setRuleId(""); setTypeId(""); setScore("");
  }
  function handleIncisoChange(val: string) {
    setInciso(val); setRuleId(""); setTypeId(""); setScore("");
    // Auto-selecionar se há uma única alínea (ex: Art. 170)
    const lista = alineas(regras, artigo, val);
    if (lista.length === 1) selecionarRegra(lista[0]);
  }

  // ── busca de aluno ───────────────────────────────────────────────────
  const buscarAluno = useCallback(async (num: string) => {
    if (!num.trim()) { setAluno(null); setErroAluno(""); return; }
    alunoAbortRef.current?.abort();
    const ac = new AbortController();
    alunoAbortRef.current = ac;
    setBuscando(true); setErroAluno("");
    try {
      const params = new URLSearchParams({ q: num.trim() });
      if (cursoSelecionadoId) params.set("courseId", cursoSelecionadoId);
      const res = await fetch(`/api/alunos/por-numero?${params}`, { signal: ac.signal });
      const data = await res.json();
      if (data.aluno) { setAluno(data.aluno); setErroAluno(""); }
      else { setAluno(null); setErroAluno("Nenhum aluno encontrado com este número ou nome de guerra."); }
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      setErroAluno("Erro ao buscar aluno.");
    } finally {
      if (alunoAbortRef.current === ac) setBuscando(false);
    }
  }, [cursoSelecionadoId]);

  function handleNumChange(val: string) {
    setNumCurso(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => buscarAluno(val), 600);
  }

  async function buscarComunicante(q: string) {
    if (q.length < 2) { setCommResults([]); setCommErro(""); return; }
    commAbortRef.current?.abort();
    const ac = new AbortController();
    commAbortRef.current = ac;
    setCommBuscando(true); setCommErro("");
    try {
      const res = await fetch(`/api/comunicante/buscar?q=${encodeURIComponent(q)}`, { signal: ac.signal });
      const data = await res.json();
      setCommResults(data.results ?? []);
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      setCommResults([]); setCommErro("Erro ao buscar. Tente novamente.");
    } finally {
      if (commAbortRef.current === ac) setCommBuscando(false);
    }
  }
  function handleCommQueryChange(val: string) {
    setCommQuery(val);
    setCommSelecionado(null);
    setCommResults([]);
    setCommErro("");
    if (commDebounceRef.current) clearTimeout(commDebounceRef.current);
    commDebounceRef.current = setTimeout(() => buscarComunicante(val), 400);
  }
  function selecionarComunicante(r: CommResult) {
    setCommSelecionado(r);
    setCommRank(r.rank);
    setCommName(r.name);
    setCommUserId(r.userId);
    setCommResults([]);
    setCommQuery("");
  }
  function limparComunicante() {
    setCommSelecionado(null);
    setCommRank("");
    setCommName("");
    setCommUserId("");
  }

  const dispositivoCompleto = !!ruleId;

  const cursoObrigatorio = cursos && cursos.length > 0;
  const cursoOk = !cursoObrigatorio || !!cursoSelecionadoId;
  const commOk = !!commName.trim();

  return (
    <form action={formAction} className="bg-white rounded-xl border border-gray-200 p-6 space-y-6">

      {/* ── SELEÇÃO DO CURSO ──────────────────────────────────────── */}
      {cursoObrigatorio && (
        <fieldset className="border border-indigo-200 rounded-lg p-4 bg-indigo-50">
          <legend className="text-sm font-semibold text-indigo-800 px-2">Curso</legend>
          <div className="mt-2">
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Selecione o curso do aluno <span className="text-red-500">*</span>
            </label>
            <select
              value={cursoSelecionadoId}
              onChange={(e) => {
                setCursoSelecionadoId(e.target.value);
                setAluno(null);
                setNumCurso("");
                setErroAluno("");
              }}
              className="input"
            >
              <option value="">— Selecione o curso —</option>
              {cursos!.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        </fieldset>
      )}

      {/* ── IDENTIFICAÇÃO DO ALUNO ─────────────────────────────────── */}
      <fieldset className={`border rounded-lg p-4 ${cursoOk ? "border-blue-200 bg-blue-50" : "border-gray-200 bg-gray-50 opacity-60"}`}>
        <legend className="text-sm font-semibold text-blue-800 px-2">Identificação do Aluno</legend>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Número de curso ou nome de guerra *</label>
            <input
              value={numCurso}
              onChange={(e) => handleNumChange(e.target.value)}
              placeholder={cursoOk ? "Ex: 001 ou SILVA" : "Selecione o curso primeiro"}
              disabled={!cursoOk}
              className="input disabled:cursor-not-allowed"
              autoComplete="off"
            />
            {buscando && <p className="text-xs text-blue-600 mt-1">Buscando...</p>}
            {erroAluno && <p className="text-xs text-red-600 mt-1">{erroAluno}</p>}
          </div>
          {aluno && (
            <>
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
              <div><label className="block text-xs font-medium text-gray-600 mb-1">NF (Número Funcional)</label>
                <p className="input bg-gray-50 text-gray-700">{aluno.functionalNumber ?? "—"}</p></div>
            </>
          )}
        </div>
        {aluno && <input type="hidden" name="studentId" value={aluno.id} />}
        {!aluno && <input type="hidden" name="studentId" value="" />}
      </fieldset>

      {/* ── PERÍODO DE ADAPTAÇÃO ──────────────────────────────────── */}
      <fieldset className={`border rounded-lg p-4 ${adaptationPeriod ? "border-orange-300 bg-orange-50" : "border-gray-200 bg-gray-50"}`}>
        <legend className="text-sm font-semibold px-2 text-gray-700">Período de Adaptação?</legend>
        <input type="hidden" name="adaptationPeriod" value={adaptationPeriod ? "true" : "false"} />
        <div className="flex gap-6 mt-2">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="radio"
              checked={!adaptationPeriod}
              onChange={() => setAdaptationPeriod(false)}
              className="w-4 h-4 accent-[#1e3a5f]"
            />
            Não
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="radio"
              checked={adaptationPeriod}
              onChange={() => setAdaptationPeriod(true)}
              className="w-4 h-4 accent-orange-600"
            />
            Sim
          </label>
        </div>
        {adaptationPeriod && (
          <p className="text-sm text-orange-800 mt-3 bg-orange-100 rounded-lg px-3 py-2 border border-orange-200">
            A publicação da presente comunicação não incidirá sobre a nota de conduta, independente da decisão.
          </p>
        )}
      </fieldset>

      {/* ── DISPOSITIVO LEGAL ─────────────────────────────────────── */}
      <input type="hidden" name="manualRuleId" value={ruleId} />
      {regraAutoFill ? (
        <div className="flex items-start gap-3 border border-green-300 bg-green-50 rounded-lg px-4 py-3">
          <span className="text-green-600 mt-0.5">✓</span>
          <div>
            <p className="text-xs font-semibold text-green-800 uppercase tracking-wide mb-0.5">Dispositivo Legal</p>
            <p className="text-sm font-medium text-green-900">
              Art. {regraAutoFill.article}
              {regraAutoFill.item && `, Inc. ${regraAutoFill.item}`}
              {regraAutoFill.letter && `, Al. ${regraAutoFill.letter}`}
            </p>
            {regraAutoFill.description && (
              <p className="text-xs text-green-700 mt-0.5">{regraAutoFill.description}</p>
            )}
          </div>
        </div>
      ) : (
        <fieldset className={`border rounded-lg p-4 ${dispositivoCompleto ? "border-green-300 bg-green-50" : "border-orange-200 bg-orange-50"}`}>
          <legend className="text-sm font-semibold px-2 text-gray-800">
            Dispositivo Legal <span className="text-red-500">*</span>
            {dispositivoCompleto && <span className="ml-2 text-green-700 font-normal text-xs">✓ selecionado</span>}
          </legend>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-3">
            {/* 1) ARTIGO */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Artigo *</label>
              <select
                value={artigo}
                onChange={(e) => handleArtigoChange(e.target.value)}
                className="input"
                required
              >
                <option value="">Selecione o artigo</option>
                {listaArtigos.map((a) => (
                  <option key={a.article} value={a.article}>
                    Art. {a.article}{a.theme ? ` — ${a.theme}` : ""}
                  </option>
                ))}
              </select>
            </div>

            {/* 2) INCISO */}
            {artigo && (
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Inciso *</label>
                <select
                  value={inciso}
                  onChange={(e) => handleIncisoChange(e.target.value)}
                  className="input"
                  required
                >
                  <option value="">Selecione o inciso</option>
                  {listaIncisos.map((i) => (
                    <option key={i} value={i}>Inciso {i}</option>
                  ))}
                </select>
              </div>
            )}

            {/* 3) ALÍNEA / CONDUTA */}
            {artigo && inciso && listaAlineas.length > 1 && (
              <div className="sm:col-span-1">
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  {listaAlineas[0].letter ? "Alínea / Conduta *" : "Conduta *"}
                </label>
                <select
                  value={ruleId}
                  onChange={(e) => {
                    const r = regras.find((x) => x.id === e.target.value);
                    if (r) selecionarRegra(r);
                  }}
                  className="input"
                  required
                >
                  <option value="">Selecione a conduta</option>
                  {listaAlineas.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.letter ? `Al. ${r.letter} — ` : ""}{r.description}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {regraAtual && (
            <div className="mt-3 bg-white border border-green-200 rounded-lg px-4 py-3">
              <p className="text-xs text-gray-500 mb-0.5">Conduta selecionada:</p>
              <p className="text-sm text-gray-800 font-medium">
                Art. {regraAtual.article}
                {regraAtual.item && `, Inc. ${regraAtual.item}`}
                {regraAtual.letter && `, Al. ${regraAtual.letter}`}
              </p>
              <p className="text-sm text-gray-700 mt-1">{regraAtual.description}</p>
            </div>
          )}

          {!dispositivoCompleto && artigo && (
            <p className="text-xs text-orange-700 mt-2">Complete a seleção do inciso e alínea para prosseguir.</p>
          )}
          {!artigo && (
            <p className="text-xs text-gray-500 mt-2">Selecione o artigo para iniciar.</p>
          )}
        </fieldset>
      )}

      {/* ── DADOS DA COMUNICAÇÃO ──────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Comunicação *</label>
          <select
            name="typeId"
            required
            value={typeId}
            onChange={(e) => setTypeId(e.target.value)}
            className="input"
          >
            <option value="">
              {dispositivoCompleto ? "Selecione (auto-preenchido)" : "Selecione o dispositivo legal primeiro"}
            </option>
            {tipos.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} ({t.score.toFixed(1)} pt)
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Pontuação sugerida</label>
          <input
            name="suggestedScore"
            type="number"
            step="0.1"
            min="0"
            value={score}
            onChange={(e) => setScore(e.target.value)}
            placeholder="Auto-preenchida ao selecionar o dispositivo"
            className="input"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Data do Fato *</label>
          <input name="factDate" type="date" required className="input" defaultValue={dataLocalISO()} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Hora do Fato</label>
          <input name="factTime" type="time" className="input" />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">Local do Fato</label>
          <input name="factPlace" className="input" placeholder="Ex: Pátio de instrução" />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Descrição / Observações do Fato *</label>
        <textarea name="factDescription" required rows={4} className="input"
          placeholder="Descreva o fato ocorrido..." />
      </div>

      {/* ── ANEXOS (meios de prova) ───────────────────────────────── */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Anexos — Meios de Prova
          <span className="ml-1.5 text-gray-400 font-normal text-xs">opcional · PNG, JPEG ou PDF · máx. 5 MB total</span>
        </label>
        <div
          className="border-2 border-dashed border-gray-200 rounded-lg px-4 py-3 flex items-center gap-3 hover:border-blue-300 hover:bg-blue-50 transition-colors cursor-pointer"
          onClick={() => fileInputRef.current?.click()}
        >
          <span className="text-xl shrink-0">📎</span>
          <div className="min-w-0">
            <p className="text-sm text-gray-600 font-medium">Clique para selecionar arquivos</p>
            <p className="text-xs text-gray-400">Imagens (PNG, JPEG) ou PDF</p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            name="file"
            multiple
            accept=".png,.jpg,.jpeg,.pdf"
            className="hidden"
            onChange={(e) => setArquivos(Array.from(e.target.files ?? []))}
          />
        </div>
        {arquivos.length > 0 && (
          <ul className="mt-2 space-y-1.5">
            {arquivos.map((f, i) => (
              <li key={i} className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                <span className="text-sm shrink-0">{f.type === "application/pdf" ? "📄" : "🖼️"}</span>
                <span className="flex-1 text-sm text-gray-700 truncate">{f.name}</span>
                <span className="text-xs text-gray-400 shrink-0">{(f.size / 1024).toFixed(0)} KB</span>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); removerArquivo(i); }}
                  className="text-gray-400 hover:text-red-500 transition-colors shrink-0 text-base leading-none"
                  aria-label="Remover arquivo"
                >×</button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ── TESTEMUNHA(S) ─────────────────────────────────────────── */}
      <fieldset className="border border-gray-200 rounded-lg p-4 bg-gray-50">
        <legend className="text-sm font-semibold text-gray-700 px-2">Testemunha(s)</legend>
        <div className="space-y-3 mt-2">
          {testemunhaKeys.length === 0 && (
            <p className="text-xs text-gray-400">Nenhuma testemunha adicionada.</p>
          )}
          {testemunhaKeys.map((key, idx) => (
            <TestemunhaRow key={key} idx={idx} onRemove={() => removeTestemunha(key)} />
          ))}
          <button
            type="button"
            onClick={addTestemunha}
            className="text-xs text-[#1e3a5f] border border-[#1e3a5f] rounded-lg px-3 py-1.5 hover:bg-blue-50 transition-colors"
          >
            + Adicionar testemunha
          </button>
        </div>
      </fieldset>

      {/* ── COMUNICANTE ───────────────────────────────────────────── */}
      <fieldset className="border border-gray-200 rounded-lg p-4 bg-gray-50">
        <legend className="text-sm font-semibold text-gray-700 px-2">
          Comunicante <span className="text-red-500">*</span>
        </legend>

        {/* Hidden inputs always submitted */}
        <input type="hidden" name="communicantRank" value={commRank} />
        <input type="hidden" name="communicantName" value={commName} />
        <input type="hidden" name="communicantUserId" value={commUserId} />

        {comunicanteFixo ? (
          /* Aluno CFO: comunicante é o próprio aluno, não editável */
          <div className="mt-2 flex items-center gap-3 bg-white border border-blue-200 rounded-lg px-3 py-2">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900">
                {commRank && (
                  <span className="font-mono text-xs bg-gray-100 px-1 mr-1.5 rounded">{commRank}</span>
                )}
                {commName}
              </p>
              <p className="text-xs text-gray-500 truncate">{comunicanteFixo.fullName} · {comunicanteFixo.detail}</p>
            </div>
            <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full whitespace-nowrap">Aluno</span>
            <span className="text-xs text-gray-400 italic whitespace-nowrap">Automático</span>
          </div>
        ) : (
          /* Staff: Tabs — Buscar cadastrado / Preencher manualmente */
          <>
            <div className="flex gap-1 mt-2 mb-3">
              <button
                type="button"
                onClick={() => setCommTab("buscar")}
                className={`text-xs font-medium px-3 py-1.5 rounded-md transition-colors ${
                  commTab === "buscar"
                    ? "bg-[#1e3a5f] text-white"
                    : "bg-white border border-gray-300 text-gray-600 hover:bg-gray-100"
                }`}
              >
                Buscar cadastrado
              </button>
              <button
                type="button"
                onClick={() => setCommTab("manual")}
                className={`text-xs font-medium px-3 py-1.5 rounded-md transition-colors ${
                  commTab === "manual"
                    ? "bg-[#1e3a5f] text-white"
                    : "bg-white border border-gray-300 text-gray-600 hover:bg-gray-100"
                }`}
              >
                Preencher manualmente
              </button>
            </div>

            {commTab === "buscar" && (
              <div className="space-y-2">
                {!commSelecionado ? (
                  <>
                    <input
                      value={commQuery}
                      onChange={(e) => handleCommQueryChange(e.target.value)}
                      placeholder="Pesquise por nome, RG ou NF..."
                      className="input text-sm"
                      autoComplete="off"
                    />
                    {commBuscando && <p className="text-xs text-blue-600">Buscando...</p>}
                    {commErro && <p className="text-xs text-red-600">{commErro}</p>}
                    {!commBuscando && !commErro && commQuery.length >= 2 && commResults.length === 0 && (
                      <p className="text-xs text-gray-400">Nenhum resultado encontrado. Use &quot;Preencher manualmente&quot;.</p>
                    )}
                    {commResults.length > 0 && (
                      <ul className="border border-gray-200 rounded-lg bg-white divide-y divide-gray-100 max-h-48 overflow-y-auto">
                        {commResults.map((r) => (
                          <li
                            key={r.key}
                            onClick={() => selecionarComunicante(r)}
                            className="px-3 py-2 hover:bg-blue-50 cursor-pointer flex items-center gap-2"
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
                          </li>
                        ))}
                      </ul>
                    )}
                  </>
                ) : (
                  <div className="flex items-center gap-3 bg-white border border-green-200 rounded-lg px-3 py-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900">
                        {commRank && (
                          <span className="font-mono text-xs bg-gray-100 px-1 mr-1.5 rounded">{commRank}</span>
                        )}
                        {commName}
                      </p>
                      <p className="text-xs text-gray-500 truncate">{commSelecionado.fullName} · {commSelecionado.detail}</p>
                    </div>
                    <span className={`text-xs px-1.5 py-0.5 rounded-full whitespace-nowrap ${
                      commSelecionado.tipo === "Usuário" ? "bg-indigo-100 text-indigo-700" : "bg-blue-100 text-blue-700"
                    }`}>{commSelecionado.tipo}</span>
                    <button
                      type="button"
                      onClick={limparComunicante}
                      className="text-xs text-red-500 hover:text-red-700 font-medium whitespace-nowrap"
                    >
                      Alterar
                    </button>
                  </div>
                )}
              </div>
            )}

            {commTab === "manual" && (
              <div className="grid grid-cols-1 sm:grid-cols-[180px_1fr] gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Posto/Graduação</label>
                  <select
                    value={commRank}
                    onChange={(e) => setCommRank(e.target.value)}
                    className="input text-sm"
                  >
                    <option value="">Selecione</option>
                    {POSTOS.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Nome *</label>
                  <input
                    value={commName}
                    onChange={(e) => setCommName(e.target.value)}
                    className="input text-sm"
                    placeholder="Nome de quem verificou a transgressão ou propõe o registro"
                  />
                </div>
              </div>
            )}
          </>
        )}
      </fieldset>

      {state?.error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
          {state.error}
        </div>
      )}

      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={pending || !cursoOk || !aluno || !dispositivoCompleto || !commOk}
          className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {pending ? "Registrando..." : "Registrar Comunicação"}
        </button>
        <a href="/comunicacoes" className="btn-secondary">Cancelar</a>
      </div>
      {(!cursoOk || !aluno || !dispositivoCompleto || !commOk) && (
        <p className="text-xs text-gray-400">
          {!cursoOk ? "Selecione o curso antes de localizar o aluno. " : ""}
          {cursoOk && !aluno ? "Localize o aluno pelo número de curso. " : ""}
          {!dispositivoCompleto ? "Selecione o dispositivo legal completo. " : ""}
          {dispositivoCompleto && !commOk ? "Informe o comunicante." : ""}
        </p>
      )}
    </form>
  );
}
