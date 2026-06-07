"use client";
import { useActionState, useState } from "react";
import { salvarAluno } from "../actions";

type PlatoonOption = { id: string; name: string };
type CourseOption  = { id: string; name: string; platoons: PlatoonOption[] };

const STATUS_OPTIONS = [
  { value: "ATIVO",       label: "Ativo" },
  { value: "DESLIGADO",   label: "Desligado" },
  { value: "TRANSFERIDO", label: "Transferido" },
  { value: "FORMADO",     label: "Formado" },
  { value: "ARQUIVADO",   label: "Arquivado" },
];

type DefaultValues = {
  fullName?: string; warName?: string; courseNumber?: string;
  rg?: string; functionalNumber?: string;
  status?: string; courseId?: string; platoonId?: string;
};

type Props = { defaultValues?: DefaultValues; id?: string; courses: CourseOption[] };

export default function AlunoForm({ defaultValues, id, courses }: Props) {
  const action = salvarAluno.bind(null, id ?? null);
  const [state, formAction, pending] = useActionState(action, undefined);

  const [courseId, setCourseId] = useState(defaultValues?.courseId ?? "");
  const [platoonId, setPlatoonId] = useState(defaultValues?.platoonId ?? "");

  const selectedCourse = courses.find((c) => c.id === courseId);
  const platoons = (selectedCourse?.platoons ?? []).slice().sort((a, b) => {
    const na = parseInt(a.name) || 0;
    const nb = parseInt(b.name) || 0;
    return na - nb;
  });

  function handleCourseChange(newId: string) {
    setCourseId(newId);
    setPlatoonId("");
  }

  return (
    <form action={formAction} className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Nome completo *</label>
          <input name="fullName" defaultValue={defaultValues?.fullName} required className="input" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Nome de guerra *</label>
          <input name="warName" defaultValue={defaultValues?.warName} required className="input" />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Curso *</label>
          <select
            name="courseId"
            value={courseId}
            onChange={(e) => handleCourseChange(e.target.value)}
            required
            className="input"
          >
            <option value="">Selecione o curso</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Pelotão</label>
          <select
            name="platoonId"
            value={platoonId}
            onChange={(e) => setPlatoonId(e.target.value)}
            className="input"
            disabled={!courseId || platoons.length === 0}
          >
            <option value="">
              {!courseId ? "Selecione um curso primeiro" : platoons.length === 0 ? "Sem pelotões cadastrados" : "Sem pelotão"}
            </option>
            {platoons.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Nº de curso *</label>
          <input name="courseNumber" defaultValue={defaultValues?.courseNumber} required className="input" placeholder="001" />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">RG *</label>
          <input name="rg" defaultValue={defaultValues?.rg} required className="input" />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Número Funcional * <span className="text-gray-400 font-normal">(login)</span>
          </label>
          <input name="functionalNumber" defaultValue={defaultValues?.functionalNumber} required className="input" />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Situação</label>
          <select name="status" defaultValue={defaultValues?.status ?? "ATIVO"} className="input">
            {STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
      </div>

      <p className="text-xs text-gray-400">
        Senha do primeiro acesso: Número Funcional + RG sem pontuação.
      </p>

      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}

      <div className="flex gap-3 pt-2">
        <button type="submit" disabled={pending} className="btn-primary">
          {pending ? "Salvando..." : "Salvar"}
        </button>
        <a href="/alunos" className="btn-secondary">Cancelar</a>
      </div>
    </form>
  );
}
