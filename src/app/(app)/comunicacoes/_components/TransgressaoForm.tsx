"use client";
import { useActionState, useState, useRef, useCallback } from "react";
import Link from "next/link";
import { registrarTransgressao } from "../actions";

type Curso = { id: string; name: string };
type AlunoInfo = {
  id: string; warName: string; fullName: string;
  courseNumber: string; course: string; platoon: string | null;
  rg: string; functionalNumber: string | null;
};

// Pontuação de fallback caso o tipo não esteja cadastrado em Tipos de Comunicação.
const TD_FALLBACK: Record<string, number> = { "TD Leve": 1.0, "TD Média": 2.0, "TD Grave": 3.0 };
const TD_LABELS: { value: string; label: string }[] = [
  { value: "TD Leve",  label: "TD Leve — Transgressão Disciplinar Leve" },
  { value: "TD Média", label: "TD Média — Transgressão Disciplinar Média" },
  { value: "TD Grave", label: "TD Grave — Transgressão Disciplinar Grave" },
];

const BGPM_NUMS = Array.from({ length: 55 }, (_, i) => String(i + 1).padStart(3, "0"));

export default function TransgressaoForm({ cursos, tdScores }: { cursos: Curso[]; tdScores: Record<string, number> }) {
  const [state, formAction, pending] = useActionState(registrarTransgressao, undefined);

  // Pontuação padrão de cada TD vem de Tipos de Comunicação (tdScores); usa o
  // fallback apenas se o tipo não estiver cadastrado.
  const defaultScore = (tipo: string) => tdScores[tipo] ?? TD_FALLBACK[tipo] ?? 0;
  const TD_TIPOS = TD_LABELS.map((t) => ({ ...t, score: defaultScore(t.value) }));

  const [cursoId, setCursoId]         = useState("");
  const [numCurso, setNumCurso]       = useState("");
  const [aluno, setAluno]             = useState<AlunoInfo | null>(null);
  const [buscando, setBuscando]       = useState(false);
  const [erroAluno, setErroAluno]     = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [isTac, setIsTac]             = useState(false);
  const [tdTipo, setTdTipo]           = useState("");
  const [tacEquiv, setTacEquiv]       = useState("");

  const [score, setScore]             = useState("");
  const [scoreModificado, setScoreModificado] = useState(false);

  const [bgpmNum, setBgpmNum]         = useState("");
  const [bgpmAno, setBgpmAno]         = useState(String(new Date().getFullYear()));

  const tipoAtual = isTac ? tacEquiv : tdTipo;
  const defScore  = defaultScore(tipoAtual);

  function handleTipoChange(tipo: string) {
    setTdTipo(tipo);
    setIsTac(false);
    setTacEquiv("");
    const def = defaultScore(tipo);
    setScore(def > 0 ? String(def) : "");
    setScoreModificado(false);
  }

  function handleTacToggle() {
    setIsTac(true);
    setTdTipo("");
    setTacEquiv("");
    setScore("");
    setScoreModificado(false);
  }

  function handleTacEquivChange(val: string) {
    setTacEquiv(val);
    const def = defaultScore(val);
    setScore(def > 0 ? String(def) : "");
    setScoreModificado(false);
  }

  function handleScoreChange(val: string) {
    setScore(val);
    const def = defaultScore(tipoAtual);
    setScoreModificado(def > 0 && parseFloat(val) !== def);
  }

  const buscarAluno = useCallback(async (num: string) => {
    if (!num.trim()) { setAluno(null); setErroAluno(""); return; }
    setBuscando(true); setErroAluno("");
    try {
      const params = new URLSearchParams({ q: num.trim() });
      if (cursoId) params.set("courseId", cursoId);
      const res  = await fetch(`/api/alunos/por-numero?${params}`);
      const data = await res.json();
      if (data.aluno) { setAluno(data.aluno); setErroAluno(""); }
      else            { setAluno(null); setErroAluno("Nenhum aluno encontrado."); }
    } catch { setErroAluno("Erro ao buscar aluno."); }
    finally { setBuscando(false); }
  }, [cursoId]);

  function handleNumChange(val: string) {
    setNumCurso(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => buscarAluno(val), 600);
  }

  const selecionouTipo = isTac ? !!tacEquiv : !!tdTipo;
  const formOk = !!aluno && !!cursoId && selecionouTipo && !!score && parseFloat(score) > 0 && !!bgpmNum && !!bgpmAno;

  return (
    <form action={formAction} className="bg-white rounded-xl border border-gray-200 p-6 space-y-6">

      {/* Curso */}
      <fieldset className="border border-indigo-200 rounded-lg p-4 bg-indigo-50">
        <legend className="text-sm font-semibold text-indigo-800 px-2">Curso</legend>
        <div className="mt-2">
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Selecione o curso do aluno <span className="text-red-500">*</span>
          </label>
          <select
            name="courseId"
            value={cursoId}
            onChange={(e) => { setCursoId(e.target.value); setAluno(null); setNumCurso(""); setErroAluno(""); }}
            className="input"
            required
          >
            <option value="">— Selecione o curso —</option>
            {cursos.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      </fieldset>

      {/* Identificação do aluno */}
      <fieldset className={`border rounded-lg p-4 ${cursoId ? "border-blue-200 bg-blue-50" : "border-gray-200 bg-gray-50 opacity-60"}`}>
        <legend className="text-sm font-semibold text-blue-800 px-2">Identificação do Aluno</legend>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Número de curso ou nome de guerra *</label>
            <input
              value={numCurso}
              onChange={(e) => handleNumChange(e.target.value)}
              placeholder={cursoId ? "Ex: 001 ou SILVA" : "Selecione o curso primeiro"}
              disabled={!cursoId}
              className="input disabled:cursor-not-allowed"
              autoComplete="off"
            />
            {buscando  && <p className="text-xs text-blue-600 mt-1">Buscando...</p>}
            {erroAluno && <p className="text-xs text-red-600 mt-1">{erroAluno}</p>}
          </div>
          {aluno && (<>
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
          </>)}
        </div>
        {aluno  && <input type="hidden" name="studentId" value={aluno.id} />}
        {!aluno && <input type="hidden" name="studentId" value="" />}
      </fieldset>

      {/* Tipo de transgressão */}
      <fieldset className="border border-orange-200 rounded-lg p-4 bg-orange-50">
        <legend className="text-sm font-semibold text-orange-800 px-2">Tipo de Transgressão *</legend>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
          {TD_TIPOS.map((t) => (
            <label
              key={t.value}
              className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                !isTac && tdTipo === t.value
                  ? "border-orange-500 bg-orange-100"
                  : "border-gray-200 bg-white hover:border-orange-300"
              }`}
            >
              <input
                type="radio"
                name="tipoComunicacao"
                value={t.value}
                checked={!isTac && tdTipo === t.value}
                onChange={() => handleTipoChange(t.value)}
                className="mt-0.5"
              />
              <div>
                <p className="text-sm font-semibold text-gray-900">{t.value}</p>
                <p className="text-xs text-gray-500 mt-0.5">Desconto de {t.score.toFixed(1)} ponto(s)</p>
              </div>
            </label>
          ))}

          {/* TAC */}
          <label className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
            isTac ? "border-purple-500 bg-purple-50" : "border-gray-200 bg-white hover:border-purple-300"
          }`}>
            <input
              type="radio"
              name="tipoComunicacao"
              value="TAC"
              checked={isTac}
              onChange={handleTacToggle}
              className="mt-0.5"
            />
            <div>
              <p className="text-sm font-semibold text-gray-900">TAC</p>
              <p className="text-xs text-gray-500 mt-0.5">Termo de Ajuste de Conduta</p>
            </div>
          </label>
        </div>

        {/* Transgressão equivalente (só para TAC) */}
        {isTac && (
          <div className="mt-4 border border-purple-200 rounded-lg p-4 bg-white">
            <label className="block text-sm font-semibold text-purple-800 mb-2">
              Transgressão equivalente <span className="text-red-500">*</span>
            </label>
            <select
              name="tacEquivalent"
              value={tacEquiv}
              onChange={(e) => handleTacEquivChange(e.target.value)}
              className="input"
              required={isTac}
            >
              <option value="">— Selecione —</option>
              {TD_TIPOS.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
            {tacEquiv && (
              <p className="text-xs text-purple-700 mt-2">
                Desconto equivalente a {defaultScore(tacEquiv).toFixed(1)} ponto(s) — {tacEquiv}
              </p>
            )}
          </div>
        )}

        {!isTac && <input type="hidden" name="tacEquivalent" value="" />}
      </fieldset>

      {/* Pontuação */}
      {selecionouTipo && (
        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-700">
            Pontuação a descontar *
          </label>
          <input
            name="score"
            type="number"
            step="0.1"
            min="0.1"
            value={score}
            onChange={(e) => handleScoreChange(e.target.value)}
            className="input max-w-xs"
          />
          {scoreModificado && (
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mt-1">
              ⚠ A pontuação foi alterada do padrão ({defScore.toFixed(1)} pt) para {score} pt.
              Certifique-se de que a alteração está correta.
            </p>
          )}
          {!scoreModificado && defScore > 0 && (
            <p className="text-xs text-gray-400">Padrão NPCE para {tipoAtual}: {defScore.toFixed(1)} ponto(s).</p>
          )}
        </div>
      )}

      {/* BGPM */}
      <fieldset className="border border-gray-200 rounded-lg p-4 bg-gray-50">
        <legend className="text-sm font-semibold text-gray-700 px-2">BGPM de Publicação *</legend>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Nº do BGPM *</label>
            <select
              name="bgpmNumber"
              value={bgpmNum}
              onChange={(e) => setBgpmNum(e.target.value)}
              className="input"
              required
            >
              <option value="">— Selecione —</option>
              {BGPM_NUMS.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Ano do BGPM *</label>
            <input
              name="bgpmYear"
              type="text"
              value={bgpmAno}
              onChange={(e) => setBgpmAno(e.target.value)}
              placeholder="Ex: 2026"
              maxLength={4}
              className="input"
              required
            />
          </div>
        </div>
      </fieldset>

      {state?.error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
          {state.error}
        </div>
      )}

      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={pending || !formOk}
          className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {pending ? "Registrando..." : "Registrar"}
        </button>
        <Link href="/comunicacoes" className="btn-secondary">Cancelar</Link>
      </div>

      {!formOk && (
        <p className="text-xs text-gray-400">
          {!cursoId ? "Selecione o curso. " : ""}
          {cursoId && !aluno ? "Localize o aluno. " : ""}
          {!selecionouTipo ? "Selecione o tipo de transgressão. " : ""}
          {selecionouTipo && (!score || parseFloat(score) <= 0) ? "Informe a pontuação. " : ""}
          {(!bgpmNum || !bgpmAno) ? "Preencha os dados do BGPM." : ""}
        </p>
      )}
    </form>
  );
}
