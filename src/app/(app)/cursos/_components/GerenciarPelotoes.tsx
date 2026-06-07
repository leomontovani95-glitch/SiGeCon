"use client";
import { useActionState } from "react";
import { adicionarPelotaoNoCurso, excluirPelotaoNoCurso } from "../actions";

type Platoon = { id: string; name: string; studentCount: number };
type Props = { platoons: Platoon[]; courseId: string };
type State = { error: string } | undefined;

function ExcluirPelotaoBtn({ courseId, platoonId }: { courseId: string; platoonId: string }) {
  const action = excluirPelotaoNoCurso.bind(null, courseId, platoonId);
  const [state, formAction, pending] = useActionState(action, undefined);
  return (
    <form action={formAction} className="flex items-center gap-2">
      {state?.error && <span className="text-xs text-red-600">{state.error}</span>}
      <button type="submit" disabled={pending} className="text-xs text-red-600 hover:underline disabled:opacity-50">
        {pending ? "Excluindo..." : "Excluir"}
      </button>
    </form>
  );
}

export default function GerenciarPelotoes({ platoons, courseId }: Props) {
  const addAction = adicionarPelotaoNoCurso.bind(null, courseId);
  const [addState, addFormAction, addPending] = useActionState<State, FormData>(addAction, undefined);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4 mt-6">
      <h2 className="text-lg font-semibold text-gray-900">Pelotões</h2>

      {platoons.length === 0 ? (
        <p className="text-sm text-gray-500">Nenhum pelotão cadastrado.</p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {platoons.map((p) => (
            <li key={p.id} className="flex items-center justify-between py-2">
              <span className="text-sm text-gray-700">{p.name}</span>
              {p.studentCount > 0 ? (
                <span className="text-xs text-gray-400">{p.studentCount} aluno(s)</span>
              ) : (
                <ExcluirPelotaoBtn courseId={courseId} platoonId={p.id} />
              )}
            </li>
          ))}
        </ul>
      )}

      <form action={addFormAction} className="flex gap-2 pt-2 border-t border-gray-100">
        <input name="name" required placeholder="Ex: 1º Pelotão" className="input flex-1" />
        <button type="submit" disabled={addPending} className="btn-primary whitespace-nowrap">
          {addPending ? "Adicionando..." : "Adicionar Pelotão"}
        </button>
      </form>
      {addState?.error && <p className="text-sm text-red-600">{addState.error}</p>}
    </div>
  );
}
