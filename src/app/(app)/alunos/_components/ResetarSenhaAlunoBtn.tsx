"use client";
import { useState } from "react";
import { useActionState } from "react";
import { resetarSenhaAluno } from "../actions";

export default function ResetarSenhaAlunoBtn({ studentId }: { studentId: string }) {
  const action = resetarSenhaAluno.bind(null, studentId);
  const [state, formAction, pending] = useActionState(action, undefined);
  const [confirming, setConfirming] = useState(false);

  return (
    <div className="mt-6 border-t border-gray-200 pt-6">
      <h3 className="text-sm font-semibold text-gray-700 mb-1">Redefinir Senha do Aluno</h3>
      <p className="text-xs text-gray-500 mb-3">
        A senha será redefinida para o <strong>Número Funcional</strong> do aluno.
        O aluno poderá alterá-la em <em>Meu Perfil</em> após o próximo acesso.
      </p>
      {state?.success && (
        <div className="mb-3 bg-green-50 border border-green-200 rounded-lg px-4 py-2 text-sm text-green-700">
          {state.success}
        </div>
      )}
      {state?.error && (
        <div className="mb-3 bg-red-50 border border-red-200 rounded-lg px-4 py-2 text-sm text-red-700">
          {state.error}
        </div>
      )}
      {!confirming ? (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          Redefinir Senha para Nº Funcional
        </button>
      ) : (
        <div className="flex flex-wrap items-center gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <span className="text-amber-800 text-sm font-medium">Confirma a redefinição de senha?</span>
          <form action={formAction} className="flex items-center gap-2">
            <button
              type="submit"
              disabled={pending}
              className="bg-amber-500 hover:bg-amber-600 text-white px-3 py-1.5 rounded text-xs font-medium transition-colors disabled:opacity-50"
            >
              {pending ? "Redefinindo..." : "Sim, redefinir"}
            </button>
          </form>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            className="text-gray-600 hover:text-gray-800 text-xs px-3 py-1.5 border border-gray-300 rounded hover:bg-gray-50 transition-colors"
          >
            Cancelar
          </button>
        </div>
      )}
    </div>
  );
}
