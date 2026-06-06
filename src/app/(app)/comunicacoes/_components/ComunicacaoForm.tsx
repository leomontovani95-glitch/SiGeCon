"use client";
import { useActionState, useState, useRef, useCallback, useMemo } from "react";
import { registrarComunicacao } from "../actions";

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

type Props = { tipos: Tipo[]; regras: Regra[]; cursos?: Curso[] };

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

// ── componente ────────────────────────────────────────────────────────────
export default function ComunicacaoForm({ tipos, regras, cursos }: Props) {
  const [state, formAction, pending] = useActionState(registrarComunicacao, undefined);

  // Curso selecionado (quando lista é fornecida)
  const [cursoSelecionadoId, setCursoSelecionadoId] = useState("");

  // Aluno
  const [numCurso, setNumCurso] = useState("");
  const [aluno, setAluno] = useState<AlunoInfo | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [erroAluno, setErroAluno] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cascata dispositivo legal
  const [artigo, setArtigo] = useState("");
  const [inciso, setInciso] = useState("");
  const [ruleId, setRuleId] = useState("");

  // Tipo e pontuação (controlados para auto-fill)
  const [typeId, setTypeId] = useState("");
  const [score, setScore] = useState("");

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
    if (r.defaultCommunicationType) {
      const tid = tipoByName[r.defaultCommunicationType];
      if (tid) setTypeId(tid);
    }
    if (r.defaultScore != null) setScore(String(r.defaultScore));
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
    setBuscando(true); setErroAluno("");
    try {
      const params = new URLSearchParams({ q: num.trim() });
      if (cursoSelecionadoId) params.set("courseId", cursoSelecionadoId);
      const res = await fetch(`/api/alunos/por-numero?${params}`);
      const data = await res.json();
      if (data.aluno) { setAluno(data.aluno); setErroAluno(""); }
      else { setAluno(null); setErroAluno("Nenhum aluno encontrado com este número de curso."); }
    } catch { setErroAluno("Erro ao buscar aluno."); }
    finally { setBuscando(false); }
  }, [cursoSelecionadoId]);

  function handleNumChange(val: string) {
    setNumCurso(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => buscarAluno(val), 600);
  }

  const dispositivoCompleto = !!ruleId;

  const cursoObrigatorio = cursos && cursos.length > 0;
  const cursoOk = !cursoObrigatorio || !!cursoSelecionadoId;

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
            <label className="block text-xs font-medium text-gray-600 mb-1">Número de curso *</label>
            <input
              value={numCurso}
              onChange={(e) => handleNumChange(e.target.value)}
              placeholder={cursoOk ? "Digite o número (ex: 001)" : "Selecione o curso primeiro"}
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
              <div><label className="block text-xs font-medium text-gray-600 mb-1">Pelotão</label>
                <p className="input bg-gray-50 text-gray-700">{aluno.platoon ?? "—"}</p></div>
            </>
          )}
        </div>
        {aluno && <input type="hidden" name="studentId" value={aluno.id} />}
        {!aluno && <input type="hidden" name="studentId" value="" />}
      </fieldset>

      {/* ── DISPOSITIVO LEGAL (obrigatório, cascata) ──────────────── */}
      <fieldset className={`border rounded-lg p-4 ${dispositivoCompleto ? "border-green-300 bg-green-50" : "border-orange-200 bg-orange-50"}`}>
        <legend className="text-sm font-semibold px-2 text-gray-800">
          Dispositivo Legal <span className="text-red-500">*</span>
          {dispositivoCompleto && <span className="ml-2 text-green-700 font-normal text-xs">✓ selecionado</span>}
        </legend>

        {/* hidden inputs que serão enviados ao servidor */}
        <input type="hidden" name="manualRuleId" value={ruleId} />

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

          {/* 2) INCISO — aparece após escolher artigo */}
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

          {/* 3) ALÍNEA / CONDUTA — aparece após escolher inciso, apenas quando há mais de uma opção */}
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

        {/* Descrição completa da conduta selecionada */}
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
          <input name="factDate" type="date" required className="input" />
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

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Comunicante <span className="text-red-500">*</span>
        </label>
        <input name="communicantName" required className="input"
          placeholder="Nome de quem verificou a transgressão ou propõe o registro" />
      </div>

      {state?.error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
          {state.error}
        </div>
      )}

      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={pending || !cursoOk || !aluno || !dispositivoCompleto}
          className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {pending ? "Registrando..." : "Registrar Comunicação"}
        </button>
        <a href="/comunicacoes" className="btn-secondary">Cancelar</a>
      </div>
      {(!cursoOk || !aluno || !dispositivoCompleto) && (
        <p className="text-xs text-gray-400">
          {!cursoOk ? "Selecione o curso antes de localizar o aluno. " : ""}
          {cursoOk && !aluno ? "Localize o aluno pelo número de curso. " : ""}
          {!dispositivoCompleto ? "Selecione o dispositivo legal completo." : ""}
        </p>
      )}
    </form>
  );
}
