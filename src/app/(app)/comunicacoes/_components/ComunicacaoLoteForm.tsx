"use client";
import { useActionState, useState, useRef, useCallback, useMemo } from "react";
import { registrarComunicacaoEmLote, type LoteState } from "../actions";
import { dataLocalISO } from "@/lib/utils";

const POSTOS = [
  "CEL", "TEN CEL", "MAJ", "CAP", "1º TEN", "2º TEN", "ASP OF",
  "AL OF 1º ANO", "AL OF 2º ANO", "AL OF 3º ANO",
  "SUBTEN", "1º SGT", "2º SGT", "3º SGT", "CB", "SD", "AL SD",
  "OUTRO (CIVIL)",
];

type Tipo  = { id: string; name: string; score: number };
type Regra = {
  id: string; article: string; item: string | null; letter: string | null;
  description: string; theme: string | null;
  defaultCommunicationType: string | null; defaultScore: number | null;
};
type AlunoInfo = {
  id: string; warName: string; fullName: string;
  courseNumber: string; course: string; platoon: string | null;
};
type Curso = { id: string; name: string };
type CommResult = { key: string; userId: string; rank: string; name: string; fullName: string; detail: string; tipo: "Usuário" | "Aluno" };

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

type Modo = "CPI" | "REF";

export default function ComunicacaoLoteForm({ tipos, regras, cursos }: { tipos: Tipo[]; regras: Regra[]; cursos: Curso[] }) {
  const [state, formAction, pending] = useActionState<LoteState, FormData>(registrarComunicacaoEmLote, undefined);

  // Modo: CPI ou Referência Elogiosa
  const [modo, setModo] = useState<Modo>("CPI");

  // Curso
  const [cursoId, setCursoId] = useState("");

  // Alunos selecionados
  const [alunos, setAlunos] = useState<AlunoInfo[]>([]);
  const [searchQ, setSearchQ] = useState("");
  const [searchResult, setSearchResult] = useState<AlunoInfo | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [erroAluno, setErroAluno] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Comunicante
  const commDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [commTab, setCommTab] = useState<"buscar" | "manual">("buscar");
  const [commQuery, setCommQuery] = useState("");
  const [commResults, setCommResults] = useState<CommResult[]>([]);
  const [commBuscando, setCommBuscando] = useState(false);
  const [commSelecionado, setCommSelecionado] = useState<CommResult | null>(null);
  const [commRank, setCommRank] = useState("");
  const [commName, setCommName] = useState("");
  const [commUserId, setCommUserId] = useState("");

  // Dispositivo legal
  const [artigo, setArtigo] = useState("");
  const [inciso, setInciso] = useState("");
  const [ruleId, setRuleId] = useState("");
  const [typeId, setTypeId] = useState("");
  const [score, setScore] = useState("");

  // Período de Adaptação
  const [adaptationPeriod, setAdaptationPeriod] = useState(false);

  // Testemunhas
  const [testemunhas, setTestemunhas] = useState<{ rank: string; name: string }[]>([]);

  const tipoByName = useMemo(() => Object.fromEntries(tipos.map((t) => [t.name, t.id])), [tipos]);
  const tiposCPI   = useMemo(() => tipos.filter((t) => t.name.startsWith("CPI")), [tipos]);
  const tipoRef    = useMemo(() => tipos.find((t) => t.name === "Referência Elogiosa") ?? null, [tipos]);
  const listaArtigos = useMemo(() => artigos(regras), [regras]);
  const listaIncisos = useMemo(() => incisos(regras, artigo), [regras, artigo]);
  const listaAlineas = useMemo(() => alineas(regras, artigo, inciso), [regras, artigo, inciso]);
  const regraAtual   = useMemo(() => regras.find((r) => r.id === ruleId) ?? null, [regras, ruleId]);

  function trocarModo(m: Modo) {
    setModo(m);
    setArtigo(""); setInciso(""); setRuleId(""); setScore("");
    if (m === "REF") {
      setTypeId(tipoRef?.id ?? "");
    } else {
      setTypeId("");
    }
  }

  function selecionarRegra(r: Regra) {
    setRuleId(r.id);
    if (modo === "CPI") {
      // Pontuação sugerida vem do score do tipo (CommunicationType) — fonte única.
      if (r.defaultCommunicationType) {
        const tipo = tipos.find((t) => t.name === r.defaultCommunicationType);
        if (tipo) { setTypeId(tipo.id); setScore(String(tipo.score)); }
      }
    }
  }
  function handleArtigoChange(val: string) { setArtigo(val); setInciso(""); setRuleId(""); if (modo === "CPI") { setTypeId(""); setScore(""); } }
  function handleIncisoChange(val: string) {
    setInciso(val); setRuleId(""); if (modo === "CPI") { setTypeId(""); setScore(""); }
    const lista = alineas(regras, artigo, val);
    if (lista.length === 1) selecionarRegra(lista[0]);
  }

  // Busca de aluno
  const buscarAluno = useCallback(async (q: string) => {
    if (!q.trim() || !cursoId) { setSearchResult(null); setErroAluno(""); return; }
    setBuscando(true); setErroAluno("");
    try {
      const res = await fetch(`/api/alunos/por-numero?q=${encodeURIComponent(q.trim())}&courseId=${cursoId}`);
      const data = await res.json();
      setSearchResult(data.aluno ?? null);
      if (!data.aluno) setErroAluno("Aluno não encontrado.");
    } catch { setErroAluno("Erro ao buscar."); }
    finally { setBuscando(false); }
  }, [cursoId]);

  function handleSearchChange(val: string) {
    setSearchQ(val);
    setSearchResult(null);
    setErroAluno("");
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => buscarAluno(val), 600);
  }

  function adicionarAluno(a: AlunoInfo) {
    if (alunos.some((x) => x.id === a.id)) { setErroAluno("Aluno já adicionado."); return; }
    setAlunos((prev) => [...prev, a]);
    setSearchQ(""); setSearchResult(null); setErroAluno("");
  }
  function removerAluno(id: string) { setAlunos((prev) => prev.filter((a) => a.id !== id)); }

  // Comunicante
  async function buscarComunicante(q: string) {
    if (q.length < 2) { setCommResults([]); return; }
    setCommBuscando(true);
    try {
      const res = await fetch(`/api/comunicante/buscar?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setCommResults(data.results ?? []);
    } catch { setCommResults([]); }
    finally { setCommBuscando(false); }
  }
  function handleCommQueryChange(val: string) {
    setCommQuery(val); setCommSelecionado(null); setCommResults([]);
    if (commDebounceRef.current) clearTimeout(commDebounceRef.current);
    commDebounceRef.current = setTimeout(() => buscarComunicante(val), 400);
  }
  function selecionarComunicante(r: CommResult) {
    setCommSelecionado(r); setCommRank(r.rank); setCommName(r.name); setCommUserId(r.userId);
    setCommResults([]); setCommQuery("");
  }

  const canSubmit = cursoId && alunos.length >= 2 && !!ruleId && !!typeId && !!commName.trim();
  const success = state && "success" in state && state.success;

  const isRef = modo === "REF";
  const accentBorder = isRef ? "border-teal-200"    : "border-blue-200";
  const accentBg     = isRef ? "bg-teal-50"         : "bg-blue-50";
  const accentText   = isRef ? "text-teal-800"      : "text-blue-800";
  const accentBadge  = isRef ? "text-teal-600"      : "text-blue-600";

  if (success && "protocols" in state) {
    return (
      <div className={`border rounded-xl p-6 ${isRef ? "bg-teal-50 border-teal-200" : "bg-green-50 border-green-200"}`}>
        <h2 className={`font-semibold mb-2 ${isRef ? "text-teal-900" : "text-green-900"}`}>
          {state.count} {isRef ? "referência(s) elogiosa(s)" : "comunicação(ões)"} registrada(s) com sucesso
        </h2>
        <ul className={`text-sm space-y-1 mb-4 ${isRef ? "text-teal-800" : "text-green-800"}`}>
          {state.protocols.map((p) => (
            <li key={p} className="font-mono">{p}</li>
          ))}
        </ul>
        {"falhas" in state && state.falhas.length > 0 && (
          <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3">
            <p className="text-sm font-semibold text-amber-900 mb-1">
              ⚠ {state.falhas.length} aluno(s) não foram registrados:
            </p>
            <ul className="text-sm text-amber-800 space-y-0.5">
              {state.falhas.map((f, i) => (
                <li key={i}>{f.label} — {f.motivo}</li>
              ))}
            </ul>
          </div>
        )}
        <div className="flex gap-3">
          <a href="/comunicacoes" className="btn-primary text-sm">Ver comunicações</a>
          <button type="button" onClick={() => window.location.reload()} className="btn-secondary text-sm">
            Novo registro em lote
          </button>
        </div>
      </div>
    );
  }

  return (
    <form action={formAction} className="bg-white rounded-xl border border-gray-200 p-6 space-y-6">

      {/* ── MODO: CPI ou REFERÊNCIA ELOGIOSA ──────────────────────── */}
      <div className={`rounded-xl border-2 p-4 ${isRef ? "border-teal-300 bg-teal-50" : "border-[#1e3a5f]/20 bg-slate-50"}`}>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Tipo de registro em lote</p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => trocarModo("CPI")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${
              !isRef
                ? "bg-[#1e3a5f] text-white shadow-sm"
                : "bg-white border border-gray-300 text-gray-600 hover:bg-gray-50"
            }`}
          >
            <span className={`w-2.5 h-2.5 rounded-full ${!isRef ? "bg-red-400" : "bg-gray-300"}`} />
            CPI
            <span className={`text-xs font-normal ${!isRef ? "opacity-75" : "text-gray-400"}`}>
              (desconta pontos)
            </span>
          </button>
          <button
            type="button"
            onClick={() => trocarModo("REF")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${
              isRef
                ? "bg-teal-600 text-white shadow-sm"
                : "bg-white border border-gray-300 text-gray-600 hover:bg-gray-50"
            }`}
          >
            <span className={`w-2.5 h-2.5 rounded-full ${isRef ? "bg-yellow-300" : "bg-gray-300"}`} />
            Referência Elogiosa
            <span className={`text-xs font-normal ${isRef ? "opacity-75" : "text-gray-400"}`}>
              (acrescenta pontos)
            </span>
          </button>
        </div>
        {isRef && (
          <p className="text-xs text-teal-700 mt-3 flex items-center gap-1.5">
            <span className="text-base leading-none">⭐</span>
            Cada aluno selecionado receberá uma Referência Elogiosa individual com protocolo próprio.
            {tipoRef && <span className="ml-1 font-semibold">Pontuação: +{tipoRef.score.toFixed(1)} pt por aluno.</span>}
          </p>
        )}
      </div>

      {/* ── CURSO ─────────────────────────────────────────────────── */}
      <fieldset className="border border-indigo-200 rounded-lg p-4 bg-indigo-50">
        <legend className="text-sm font-semibold text-indigo-800 px-2">Curso</legend>
        <div className="mt-2">
          <label className="block text-xs font-medium text-gray-600 mb-1">Selecione o curso dos alunos <span className="text-red-500">*</span></label>
          <select
            value={cursoId}
            onChange={(e) => { setCursoId(e.target.value); setAlunos([]); setSearchQ(""); setSearchResult(null); }}
            className="input"
          >
            <option value="">— Selecione o curso —</option>
            {cursos.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      </fieldset>

      {/* ── SELEÇÃO DE ALUNOS ─────────────────────────────────────── */}
      <fieldset className={`border rounded-lg p-4 ${cursoId ? `${accentBorder} ${accentBg}` : "border-gray-200 bg-gray-50 opacity-60"}`}>
        <legend className={`text-sm font-semibold px-2 ${accentText}`}>
          {isRef ? "Alunos a elogiar" : "Alunos envolvidos"} <span className="text-red-500">*</span>
          {alunos.length > 0 && <span className={`ml-2 font-normal ${accentBadge}`}>({alunos.length} selecionado{alunos.length > 1 ? "s" : ""})</span>}
        </legend>

        {/* Hidden inputs — um por aluno */}
        {alunos.map((a) => <input key={a.id} type="hidden" name="studentId" value={a.id} />)}

        {/* Busca */}
        <div className="mt-3">
          <label className="block text-xs font-medium text-gray-600 mb-1">Buscar por número de curso ou nome de guerra</label>
          <input
            value={searchQ}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder={cursoId ? "Ex: 001 ou SILVA" : "Selecione o curso primeiro"}
            disabled={!cursoId}
            className="input disabled:cursor-not-allowed"
            autoComplete="off"
          />
          {buscando && <p className="text-xs text-blue-600 mt-1">Buscando...</p>}
          {erroAluno && <p className="text-xs text-red-600 mt-1">{erroAluno}</p>}
          {searchResult && (
            <div className="mt-2 flex items-center gap-3 bg-white border border-blue-200 rounded-lg px-3 py-2">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900">{searchResult.warName}</p>
                <p className="text-xs text-gray-500">{searchResult.fullName} — Nº {searchResult.courseNumber}{searchResult.platoon ? ` — ${searchResult.platoon}` : ""}</p>
              </div>
              <button
                type="button"
                onClick={() => adicionarAluno(searchResult)}
                className={`text-xs font-medium text-white px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors ${
                  isRef ? "bg-teal-600 hover:bg-teal-700" : "bg-[#1e3a5f] hover:bg-[#16304f]"
                }`}
              >
                + Adicionar
              </button>
            </div>
          )}
        </div>

        {/* Lista de alunos selecionados */}
        {alunos.length > 0 && (
          <div className="mt-3 space-y-1">
            {alunos.map((a) => (
              <div key={a.id} className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-1.5">
                <span className="text-xs font-mono bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded">{a.courseNumber}</span>
                <span className="text-sm font-medium text-gray-900 flex-1">{a.warName}</span>
                <span className="text-xs text-gray-400">{a.platoon ?? ""}</span>
                <button type="button" onClick={() => removerAluno(a.id)} className="text-red-400 hover:text-red-600 text-xs font-medium">Remover</button>
              </div>
            ))}
          </div>
        )}
        {alunos.length < 2 && (
          <p className={`text-xs mt-2 ${accentText}`}>Adicione ao menos 2 alunos para registro em lote.</p>
        )}
      </fieldset>

      {/* ── PERÍODO DE ADAPTAÇÃO ──────────────────────────────────── */}
      <fieldset className={`border rounded-lg p-4 ${adaptationPeriod ? "border-orange-300 bg-orange-50" : "border-gray-200 bg-gray-50"}`}>
        <legend className="text-sm font-semibold px-2 text-gray-700">Período de Adaptação?</legend>
        <input type="hidden" name="adaptationPeriod" value={adaptationPeriod ? "true" : "false"} />
        <div className="flex gap-6 mt-2">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="radio" checked={!adaptationPeriod} onChange={() => setAdaptationPeriod(false)} className="w-4 h-4 accent-[#1e3a5f]" /> Não
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="radio" checked={adaptationPeriod} onChange={() => setAdaptationPeriod(true)} className="w-4 h-4 accent-orange-600" /> Sim
          </label>
        </div>
        {adaptationPeriod && (
          <p className="text-sm text-orange-800 mt-3 bg-orange-100 rounded-lg px-3 py-2 border border-orange-200">
            A publicação não incidirá sobre a nota de conduta, independente da decisão.
          </p>
        )}
      </fieldset>

      {/* ── DISPOSITIVO LEGAL ─────────────────────────────────────── */}
      <fieldset className={`border rounded-lg p-4 ${ruleId ? "border-green-300 bg-green-50" : "border-orange-200 bg-orange-50"}`}>
        <legend className="text-sm font-semibold px-2 text-gray-800">
          Dispositivo Legal <span className="text-red-500">*</span>
          {ruleId && <span className="ml-2 text-green-700 font-normal text-xs">✓ selecionado</span>}
        </legend>
        <input type="hidden" name="manualRuleId" value={ruleId} />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Artigo *</label>
            <select value={artigo} onChange={(e) => handleArtigoChange(e.target.value)} className="input" required>
              <option value="">Selecione o artigo</option>
              {listaArtigos.map((a) => (
                <option key={a.article} value={a.article}>Art. {a.article}{a.theme ? ` — ${a.theme}` : ""}</option>
              ))}
            </select>
          </div>
          {artigo && (
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Inciso *</label>
              <select value={inciso} onChange={(e) => handleIncisoChange(e.target.value)} className="input" required>
                <option value="">Selecione o inciso</option>
                {listaIncisos.map((i) => <option key={i} value={i}>Inciso {i}</option>)}
              </select>
            </div>
          )}
          {artigo && inciso && listaAlineas.length > 1 && (
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                {listaAlineas[0].letter ? "Alínea / Conduta *" : "Conduta *"}
              </label>
              <select value={ruleId} onChange={(e) => { const r = regras.find((x) => x.id === e.target.value); if (r) selecionarRegra(r); }} className="input" required>
                <option value="">Selecione a conduta</option>
                {listaAlineas.map((r) => (
                  <option key={r.id} value={r.id}>{r.letter ? `Al. ${r.letter} — ` : ""}{r.description}</option>
                ))}
              </select>
            </div>
          )}
        </div>
        {regraAtual && (
          <div className="mt-3 bg-white border border-green-200 rounded-lg px-4 py-3">
            <p className="text-xs text-gray-500 mb-0.5">Conduta selecionada:</p>
            <p className="text-sm font-medium text-gray-800">
              Art. {regraAtual.article}{regraAtual.item && `, Inc. ${regraAtual.item}`}{regraAtual.letter && `, Al. ${regraAtual.letter}`}
            </p>
            <p className="text-sm text-gray-700 mt-1">{regraAtual.description}</p>
          </div>
        )}
      </fieldset>

      {/* ── DADOS DA COMUNICAÇÃO ──────────────────────────────────── */}
      {/* hidden typeId sempre enviado */}
      <input type="hidden" name="typeId" value={typeId} />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {isRef ? (
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Comunicação</label>
            <div className="flex items-center gap-3 px-4 py-2.5 bg-teal-50 border border-teal-200 rounded-lg">
              <span className="text-base">⭐</span>
              <div>
                <p className="text-sm font-semibold text-teal-800">Referência Elogiosa</p>
                {tipoRef && <p className="text-xs text-teal-600">+{tipoRef.score.toFixed(1)} ponto(s) por aluno na nota de conduta</p>}
              </div>
            </div>
          </div>
        ) : (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Comunicação *</label>
              <select value={typeId} onChange={(e) => setTypeId(e.target.value)} className="input">
                <option value="">{ruleId ? "Selecione" : "Selecione o dispositivo legal primeiro"}</option>
                {tiposCPI.map((t) => <option key={t.id} value={t.id}>{t.name} ({t.score.toFixed(1)} pt)</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Pontuação sugerida</label>
              <input name="suggestedScore" type="number" step="0.1" min="0" value={score} onChange={(e) => setScore(e.target.value)} className="input" />
            </div>
          </>
        )}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{isRef ? "Data do Elogio *" : "Data do Fato *"}</label>
          <input name="factDate" type="date" required className="input" defaultValue={dataLocalISO()} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{isRef ? "Hora" : "Hora do Fato"}</label>
          <input name="factTime" type="time" className="input" />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">{isRef ? "Local" : "Local do Fato"}</label>
          <input name="factPlace" className="input" placeholder={isRef ? "Ex: Sala de aula, pátio..." : "Ex: Pátio de instrução"} />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {isRef ? "Motivação / Descrição do Elogio *" : "Descrição / Observações do Fato *"}
        </label>
        <textarea
          name="factDescription"
          required
          rows={4}
          className="input"
          placeholder={isRef
            ? "Descreva a conduta exemplar que motivou o elogio..."
            : "Descreva o fato ocorrido..."}
        />
      </div>

      {/* ── TESTEMUNHAS ───────────────────────────────────────────── */}
      <fieldset className="border border-gray-200 rounded-lg p-4 bg-gray-50">
        <legend className="text-sm font-semibold text-gray-700 px-2">Testemunha(s)</legend>
        <div className="space-y-3 mt-2">
          {testemunhas.length === 0 && <p className="text-xs text-gray-400">Nenhuma testemunha adicionada.</p>}
          {testemunhas.map((w, i) => (
            <div key={i} className="grid grid-cols-1 sm:grid-cols-[180px_1fr_auto] gap-2 items-end">
              <div>
                {i === 0 && <label className="block text-xs font-medium text-gray-600 mb-1">Posto/Graduação</label>}
                <select name="witnessRank" value={w.rank} onChange={(e) => setTestemunhas((t) => t.map((x, idx) => idx === i ? { ...x, rank: e.target.value } : x))} className="input text-sm">
                  <option value="">Selecione</option>
                  {POSTOS.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div>
                {i === 0 && <label className="block text-xs font-medium text-gray-600 mb-1">Nome</label>}
                <input name="witnessName" value={w.name} onChange={(e) => setTestemunhas((t) => t.map((x, idx) => idx === i ? { ...x, name: e.target.value } : x))} className="input text-sm" />
              </div>
              <button type="button" onClick={() => setTestemunhas((t) => t.filter((_, idx) => idx !== i))} className="text-red-500 hover:text-red-700 text-xs px-2 py-2 whitespace-nowrap">Remover</button>
            </div>
          ))}
          <button type="button" onClick={() => setTestemunhas((t) => [...t, { rank: "", name: "" }])} className="text-xs text-[#1e3a5f] border border-[#1e3a5f] rounded-lg px-3 py-1.5 hover:bg-blue-50 transition-colors">
            + Adicionar testemunha
          </button>
        </div>
      </fieldset>

      {/* ── COMUNICANTE ───────────────────────────────────────────── */}
      <fieldset className="border border-gray-200 rounded-lg p-4 bg-gray-50">
        <legend className="text-sm font-semibold text-gray-700 px-2">Comunicante <span className="text-red-500">*</span></legend>
        <input type="hidden" name="communicantRank" value={commRank} />
        <input type="hidden" name="communicantName" value={commName} />
        <input type="hidden" name="communicantUserId" value={commUserId} />

        <div className="flex gap-1 mt-2 mb-3">
          {(["buscar", "manual"] as const).map((tab) => (
            <button key={tab} type="button" onClick={() => setCommTab(tab)}
              className={`text-xs font-medium px-3 py-1.5 rounded-md transition-colors ${commTab === tab ? "bg-[#1e3a5f] text-white" : "bg-white border border-gray-300 text-gray-600 hover:bg-gray-100"}`}>
              {tab === "buscar" ? "Buscar cadastrado" : "Preencher manualmente"}
            </button>
          ))}
        </div>

        {commTab === "buscar" && (
          <div className="space-y-2">
            {!commSelecionado ? (
              <>
                <input value={commQuery} onChange={(e) => handleCommQueryChange(e.target.value)} placeholder="Pesquise por nome, RG ou NF..." className="input text-sm" autoComplete="off" />
                {commBuscando && <p className="text-xs text-blue-600">Buscando...</p>}
                {!commBuscando && commQuery.length >= 2 && commResults.length === 0 && (
                  <p className="text-xs text-gray-400">Nenhum resultado. Use &quot;Preencher manualmente&quot;.</p>
                )}
                {commResults.length > 0 && (
                  <ul className="border border-gray-200 rounded-lg bg-white divide-y divide-gray-100 max-h-48 overflow-y-auto">
                    {commResults.map((r) => (
                      <li key={r.key} onClick={() => selecionarComunicante(r)} className="px-3 py-2 hover:bg-blue-50 cursor-pointer flex items-center gap-2">
                        <span className="bg-gray-100 text-gray-600 text-xs px-1.5 py-0.5 rounded font-mono whitespace-nowrap">{r.rank || "—"}</span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-gray-900 truncate">{r.name}</p>
                          <p className="text-xs text-gray-500 truncate">{r.fullName} · {r.detail}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            ) : (
              <div className="flex items-center gap-3 bg-white border border-green-200 rounded-lg px-3 py-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900">{commRank && <span className="font-mono text-xs bg-gray-100 px-1 mr-1.5 rounded">{commRank}</span>}{commName}</p>
                  <p className="text-xs text-gray-500 truncate">{commSelecionado.fullName} · {commSelecionado.detail}</p>
                </div>
                <button type="button" onClick={() => { setCommSelecionado(null); setCommRank(""); setCommName(""); setCommUserId(""); }} className="text-xs text-red-500 hover:text-red-700 font-medium">Alterar</button>
              </div>
            )}
          </div>
        )}

        {commTab === "manual" && (
          <div className="grid grid-cols-1 sm:grid-cols-[180px_1fr] gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Posto/Graduação</label>
              <select value={commRank} onChange={(e) => setCommRank(e.target.value)} className="input text-sm">
                <option value="">Selecione</option>
                {POSTOS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Nome *</label>
              <input value={commName} onChange={(e) => setCommName(e.target.value)} className="input text-sm" placeholder="Nome do comunicante" />
            </div>
          </div>
        )}
      </fieldset>

      {state && "error" in state && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">{state.error}</div>
      )}

      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={pending || !canSubmit}
          className={`disabled:opacity-50 disabled:cursor-not-allowed px-5 py-2.5 rounded-lg text-sm font-medium text-white transition-colors ${
            isRef
              ? "bg-teal-600 hover:bg-teal-700 focus:ring-teal-600"
              : "bg-[#1e3a5f] hover:bg-[#16304f] focus:ring-[#1e3a5f]"
          } focus:outline-none focus:ring-2 focus:ring-offset-2`}
        >
          {pending
            ? "Registrando..."
            : isRef
              ? `⭐ Registrar elogios para ${alunos.length} aluno${alunos.length !== 1 ? "s" : ""}`
              : `Registrar para ${alunos.length} aluno${alunos.length !== 1 ? "s" : ""}`
          }
        </button>
        <a href="/comunicacoes" className="btn-secondary">Cancelar</a>
      </div>
      {!canSubmit && (
        <p className="text-xs text-gray-400">
          {!cursoId ? "Selecione o curso. " : ""}
          {cursoId && alunos.length < 2 ? "Adicione ao menos 2 alunos. " : ""}
          {!ruleId ? "Selecione o dispositivo legal. " : ""}
          {!isRef && ruleId && !typeId ? "Selecione o tipo de comunicação. " : ""}
          {!commName.trim() ? "Informe o comunicante." : ""}
        </p>
      )}
    </form>
  );
}
