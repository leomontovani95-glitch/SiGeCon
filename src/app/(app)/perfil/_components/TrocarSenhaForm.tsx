"use client";
import { useActionState } from "react";
import { trocarSenha } from "../actions";

export default function TrocarSenhaForm() {
  const [state, formAction, pending] = useActionState(trocarSenha, undefined);

  return (
    <form action={formAction} className="space-y-4 max-w-sm">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Senha atual *</label>
        <input name="senhaAtual" type="password" required className="input" autoComplete="current-password" />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Nova senha * <span className="text-gray-400 font-normal">(mín. 6 caracteres)</span></label>
        <input name="novaSenha" type="password" required className="input" autoComplete="new-password" />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Confirmar nova senha *</label>
        <input name="confirmacao" type="password" required className="input" autoComplete="new-password" />
      </div>

      {state?.error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">{state.error}</div>
      )}
      {state?.success && (
        <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm text-green-700">{state.success}</div>
      )}

      <button type="submit" disabled={pending} className="btn-primary">
        {pending ? "Salvando..." : "Alterar Senha"}
      </button>
    </form>
  );
}
