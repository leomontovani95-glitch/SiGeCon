"use client";
import { useActionState, useState } from "react";
import Link from "next/link";
import { registrarElogioBi } from "../actions";
import BuscaAlunoLista, { type AlunoInfo } from "./BuscaAlunoLista";

type Curso = { id: string; name: string };
type Regra = { id: string; article: string; item: string | null; letter: string | null; description: string };

const BGPM_NUMS = Array.from({ length: 55 }, (_, i) => String(i + 1).padStart(3, "0"));

export default function ElogioBiForm({ cursos, regras }: { cursos: Curso[]; regras: Regra[] }) {
  const [state, formAction, pending] = useActionState(registrarElogioBi, undefined);

  const [cursoId, setCursoId]     = useState("");
  const [aluno, setAluno]         = useState<AlunoInfo | null>(null);

  const regraAutoFill = regras.length === 1 ? regras[0] : null;
  const [ruleId, setRuleId]       = useState(() => regraAutoFill?.id ?? "");
  const [bgpmNum, setBgpmNum]     = useState("");
  const [bgpmAno, setBgpmAno]     = useState(String(new Date().getFullYear()));

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
            onChange={(e) => { setCursoId(e.target.value); setAluno(null); }}
            className="input"
            required
          >
            <option value="">— Selecione o curso —</option>
            {cursos.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      </fieldset>

      {/* Identificação do aluno */}
      <BuscaAlunoLista key={cursoId} courseId={cursoId} enabled={!!cursoId} onChange={setAluno} />

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
              <Link href="/manual" className="underline">Manual do Aluno</Link>.
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
        <Link href="/comunicacoes" className="btn-secondary">Cancelar</Link>
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
