"use client";
import { useActionState } from "react";
import { criarContaAluno } from "../actions";

export default function CriarContaAlunoBtn({ studentId }: { studentId: string }) {
  const action = criarContaAluno.bind(null, studentId);
  const [state, formAction, pending] = useActionState(action, undefined);

  return (
    <div className="mt-6 border-t border-gray-200 pt-6">
      <h3 className="text-sm font-semibold text-gray-700 mb-1">Conta de Acesso ao Sistema</h3>

      {!state?.success ? (
        <>
          <div className="mb-3 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 flex items-start gap-2">
            <span className="text-amber-500 mt-0.5 text-sm">⚠</span>
            <p className="text-xs text-amber-800">
              Este aluno <strong>não possui conta de acesso</strong> cadastrada no sistema.
              Ao criar a conta, a senha inicial será o <strong>Número Funcional</strong> + <strong>RG sem pontuação</strong>.
              O aluno precisará alterá-la no primeiro acesso.
            </p>
          </div>
          {state?.error && (
            <div className="mb-3 bg-red-50 border border-red-200 rounded-lg px-4 py-2 text-sm text-red-700">
              {state.error}
            </div>
          )}
          <form action={formAction}>
            <button
              type="submit"
              disabled={pending}
              className="bg-[#1e3a5f] hover:bg-[#16304f] text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            >
              {pending ? "Criando conta..." : "Criar Conta de Acesso"}
            </button>
          </form>
        </>
      ) : (
        <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm text-green-800">
          {state.success}
        </div>
      )}
    </div>
  );
}
