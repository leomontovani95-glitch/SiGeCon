"use client";
import { useActionState, useState } from "react";
import Link from "next/link";
import { salvarCurso } from "../actions";
import {
  CURSOS_POR_ESCOLA,
  ANOS_LETIVOS,
  gerarSiglaCurso,
  nomeExtensoCurso,
  type EscolaCurso,
  type BaseCurso,
} from "@/lib/cursos";

type Props = { defaultValues?: Record<string, string>; id?: string };

const ESCOLA_LABEL: Record<string, string> = { ESFO: "EsFO", ESFAP: "EsFAP" };

export default function CursoForm({ defaultValues, id }: Props) {
  const action = salvarCurso.bind(null, id ?? null);
  const [state, formAction, pending] = useActionState(action, undefined);
  const editando = !!id;

  // Campos estruturados (controlados) — usados na criação e na pré-visualização.
  const [escola, setEscola] = useState<string>(defaultValues?.school ?? "");
  const [baseCourse, setBaseCourse] = useState<string>(defaultValues?.baseCourse ?? "");
  const [academicYear, setAcademicYear] = useState<string>(defaultValues?.academicYear ?? "");
  const [startYear, setStartYear] = useState<string>(defaultValues?.startYear ?? "");
  const [remnant, setRemnant] = useState<string>(defaultValues?.remnant ?? "false");

  const isEsFO = escola === "ESFO";
  const cursosDaEscola = escola ? CURSOS_POR_ESCOLA[escola as EscolaCurso] ?? [] : [];

  // Sigla gerada automaticamente (espelha a lógica do servidor).
  const siglaPronta =
    !!escola &&
    !!baseCourse &&
    (isEsFO ? !!academicYear : !!startYear);
  const sigla = siglaPronta
    ? gerarSiglaCurso({
        baseCourse: baseCourse as BaseCurso,
        academicYear: academicYear ? Number(academicYear) : null,
        startYear: startYear ? Number(startYear) : null,
        remnant: remnant === "true",
      })
    : "";

  // Ao trocar a escola, zera curso/ano (evita combinação inválida).
  function onEscolaChange(v: string) {
    setEscola(v);
    setBaseCourse("");
    setAcademicYear("");
  }

  const labelCls = "block text-sm font-medium text-gray-700 mb-1";
  const roCls = "px-3 py-2 rounded-lg bg-gray-50 border border-gray-200 text-sm text-gray-800";

  return (
    <form action={formAction} className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
      {editando ? (
        /* ── Edição: identidade travada (apenas leitura) ── */
        <>
          <input type="hidden" name="school" value={defaultValues?.school ?? ""} />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <span className={labelCls}>Escola</span>
              <div className={roCls}>{ESCOLA_LABEL[defaultValues?.school ?? ""] ?? "—"}</div>
            </div>
            <div>
              <span className={labelCls}>Sigla</span>
              <div className={`${roCls} font-semibold`}>{defaultValues?.name ?? "—"}</div>
            </div>
          </div>
          <div>
            <span className={labelCls}>Curso</span>
            <div className={roCls}>{nomeExtensoCurso(defaultValues?.name)}</div>
          </div>
          <p className="text-xs text-gray-400 -mt-2">
            A identidade do curso (escola, curso, ano e remanescente) não pode ser alterada após a criação.
          </p>
        </>
      ) : (
        /* ── Criação: selects em cascata ── */
        <>
          <div>
            <label className={labelCls}>Escola *</label>
            <select name="school" value={escola} onChange={(e) => onEscolaChange(e.target.value)} required className="input">
              <option value="" disabled>Selecione</option>
              <option value="ESFO">EsFO</option>
              <option value="ESFAP">EsFAP</option>
            </select>
          </div>

          <div>
            <label className={labelCls}>Curso *</label>
            <select
              name="baseCourse"
              value={baseCourse}
              onChange={(e) => setBaseCourse(e.target.value)}
              required
              disabled={!escola}
              className="input disabled:bg-gray-100 disabled:text-gray-400"
            >
              <option value="" disabled>{escola ? "Selecione" : "Selecione a escola primeiro"}</option>
              {cursosDaEscola.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>

          {isEsFO && (
            <div>
              <label className={labelCls}>Ano letivo do curso *</label>
              <select name="academicYear" value={academicYear} onChange={(e) => setAcademicYear(e.target.value)} required className="input">
                <option value="" disabled>Selecione</option>
                {ANOS_LETIVOS.map((a) => (
                  <option key={a} value={a}>{a}º Ano</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className={labelCls}>Ano de início do curso *</label>
            <input
              name="startYear"
              type="number"
              min="2000"
              max="2100"
              value={startYear}
              onChange={(e) => setStartYear(e.target.value)}
              required
              className="input"
              placeholder="2026"
            />
          </div>

          <div>
            <label className={labelCls}>Remanescente *</label>
            <select name="remnant" value={remnant} onChange={(e) => setRemnant(e.target.value)} required className="input">
              <option value="false">Não</option>
              <option value="true">Sim</option>
            </select>
          </div>

          <div>
            <span className={labelCls}>Sigla (gerada automaticamente)</span>
            <div className={`${roCls} font-semibold ${sigla ? "text-gray-900" : "text-gray-400"}`}>
              {sigla || "Preencha os campos acima"}
            </div>
            {sigla && <p className="text-xs text-gray-500 mt-1">{nomeExtensoCurso(sigla)}</p>}
          </div>

          <div>
            <label className={labelCls}>Quantidade de Pelotões</label>
            <input name="platoonCount" type="number" min="0" defaultValue="0" className="input" placeholder="0" />
            <p className="text-xs text-gray-400 mt-1">Pelotões serão criados automaticamente de 1º ao Nº informado.</p>
          </div>
        </>
      )}

      <div>
        <label className={labelCls}>Descrição</label>
        <input name="description" defaultValue={defaultValues?.description} className="input" />
      </div>

      <div>
        <label className={labelCls}>Situação</label>
        <select name="active" defaultValue={defaultValues?.active ?? "true"} className="input">
          <option value="true">Ativo</option>
          <option value="false">Inativo</option>
        </select>
        <p className="text-xs text-gray-400 mt-1">
          Só é possível inativar um curso após <strong>todas as comunicações</strong> estarem publicadas no
          caderno disciplinar. Ao inativar, os alunos ainda ativos são automaticamente inativados (deixam de
          receber comunicações), mas continuam cadastrados e podem ser transferidos ou ter ascensão de curso.
          Ao <strong>reativar</strong> o curso, esses alunos voltam a ativo e tudo volta a ser exibido e contado.
        </p>
      </div>

      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      <div className="flex gap-3 pt-2">
        <button type="submit" disabled={pending} className="btn-primary">{pending ? "Salvando..." : "Salvar"}</button>
        <Link href="/cursos" className="btn-secondary">Cancelar</Link>
      </div>
    </form>
  );
}
