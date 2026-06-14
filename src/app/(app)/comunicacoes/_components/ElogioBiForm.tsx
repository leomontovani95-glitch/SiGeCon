"use client";
import { useActionState, useState, useRef, useCallback } from "react";
import { registrarElogioBi } from "../actions";

type Curso = { id: string; name: string };
type Regra = { id: string; article: string; item: string | null; letter: string | null; description: string };
type AlunoInfo = {
  id: string; warName: string; fullName: string;
  courseNumber: string; course: string; platoon: string | null;
  rg: string; functionalNumber: string | null;
};

const BGPM_NUMS = Array.from({ length: 55 }, (_, i) => String(i + 1).padStart(3, "0"));

export default function ElogioBiForm({ cursos, regras }: { cursos: Curso[]; regras: Regra[] }) {
  const [state, formAction, pending] = useActionState(registrarElogioBi, undefined);

  const [cursoId, setCursoId]     = useState("");
  const [numCurso, setNumCurso]   = useState("");
  const [aluno, setAluno]         = useState<AlunoInfo | null>(null);
  const [buscando, setBuscando]   = useState(false);
  const [erroAluno, setErroAluno] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const regraAutoFill = regras.length === 1 ? regras[0] : null;
  const [ruleId, setRuleId]       = useState(() => regraAutoFill?.id ?? "");
  const [bgpmNum, setBgpmNum]     = useState("");
  const [bgpmAno, setBgpmAno]     = useState(String(new Date().getFullYear()));

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
    finally  { setBuscando(false); }
  }, [cursoId]);

  function handleNumChange(val: string) {
    setNumCurso(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => buscarAluno(val), 600);
  }

  const formOk = !!aluno && !!cursoId && !!ruleId && !!bgpmNum && !!bgpmAno;

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
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Número de curso ou nome de guerra <span className="text-red-500">*</span>
            </label>
            <input
              value={numCurso}
              onChange={(e) => handleNumChange(e.target.value)}
              placeholder={cursoId ? "Ex: 001 ou SILVA" : "Selecione o curso primeiro"}
              disabled={!cursoId}
              className="input disabled:cursor-not-allowed"
              autoComplete="off"
            />
            {buscando   && <p className="text-xs text-blue-600 mt-1">Buscando...</p>}
            {erroAluno  && <p className="text-xs text-red-600 mt-1">{erroAluno}</p>}
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
        <input type="hidden" name="studentId" value={aluno?.id ?? ""} />
      </fieldset>

      {/* Dispositivo Legal */}
      <input type="hidden" name="manualRuleId" value={ruleId} />
      <fieldset className="border border-green-200 rounded-lg p-4 bg-green-50">
        <legend className="text-sm font-semibold text-green-800 px-2">Dispositivo Legal</legend>
        <div className="mt-2">
          {regraAutoFill ? (
            <div className="flex items-start gap-3">
              <span className="text-green-600 mt-0.5">✓</span>
              <div>
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
          ) : regras.length > 0 ? (
            <>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Artigo / Inciso <span className="text-red-500">*</span>
              </label>
              <select
                name="manualRuleId"
                value={ruleId}
                onChange={(e) => setRuleId(e.target.value)}
                className="input"
                required
              >
                <option value="">— Selecione —</option>
                {regras.map((r) => (
                  <option key={r.id} value={r.id}>
                    Art. {r.article}{r.item ? ` — Inc. ${r.item}` : ""}{r.letter ? ` — Al. ${r.letter}` : ""}{r.description ? ` — ${r.description}` : ""}
                  </option>
                ))}
              </select>
            </>
          ) : (
            <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              Nenhum dispositivo legal cadastrado para &quot;Elogio publicado em BI&quot;. Cadastre em{" "}
              <a href="/manual" className="underline">Manual do Aluno</a>.
            </p>
          )}
        </div>
        <p className="text-xs text-green-700 mt-2">Pontuação: <strong>+1,0 pt</strong> na nota de conduta.</p>
      </fieldset>

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
        <a href="/comunicacoes" className="btn-secondary">Cancelar</a>
      </div>

      {!formOk && (
        <p className="text-xs text-gray-400">
          {!cursoId ? "Selecione o curso. " : ""}
          {cursoId && !aluno ? "Localize o aluno. " : ""}
          {!ruleId ? "Selecione o dispositivo legal. " : ""}
          {(!bgpmNum || !bgpmAno) ? "Preencha os dados do BGPM." : ""}
        </p>
      )}
    </form>
  );
}
