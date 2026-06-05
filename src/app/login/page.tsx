"use client";
import { useActionState, useState } from "react";
import { login } from "./actions";

export default function LoginPage() {
  const [state, action, pending] = useActionState(login, undefined);
  const [mostrarAjuda, setMostrarAjuda] = useState(false);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#1e3a5f]">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-[#1e3a5f] rounded-full mb-4">
            <span className="text-white text-2xl font-bold">SC</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">SiGeCon</h1>
          <p className="text-sm text-gray-500 mt-1">
            Sistema de Gestão de Conduta
          </p>
          <p className="text-xs text-gray-400">EsFAP / EsFO / APM-ES</p>
        </div>

        <form action={action} className="space-y-5">
          <div>
            <label
              htmlFor="cpf"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Login
            </label>
            <input
              id="cpf"
              name="cpf"
              type="text"
              autoComplete="username"
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f] focus:border-transparent"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Senha
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f] focus:border-transparent"
              placeholder="••••••••"
            />
          </div>

          {state?.error && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3">
              <p className="text-sm text-red-700">{state.error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={pending}
            className="w-full bg-[#1e3a5f] text-white py-2.5 px-4 rounded-lg text-sm font-medium hover:bg-[#16304f] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#1e3a5f] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {pending ? "Autenticando..." : "Entrar"}
          </button>
        </form>

        <div className="mt-4 text-center">
          <button
            type="button"
            onClick={() => setMostrarAjuda(!mostrarAjuda)}
            className="text-xs text-[#1e3a5f] hover:underline"
          >
            Esqueci minha senha
          </button>
        </div>

        {mostrarAjuda && (
          <div className="mt-3 bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm space-y-3">
            <p className="font-semibold text-blue-800">Redefinição de senha</p>
            <div>
              <p className="font-medium text-gray-700">Se você é aluno:</p>
              <p className="text-gray-600 mt-0.5">
                Entre em contato com o seu <strong>Chefe de Curso</strong>, que encaminhará
                a solicitação ao administrador do sistema para redefinição da senha.
              </p>
            </div>
            <div>
              <p className="font-medium text-gray-700">Se você é servidor com função:</p>
              <p className="text-gray-600 mt-0.5">
                Entre em contato diretamente com o <strong>Administrador do Sistema</strong>
                {" "}ou com o <strong>Comandante da sua Escola</strong> para solicitar
                a redefinição da senha.
              </p>
            </div>
          </div>
        )}

        <p className="text-center text-xs text-gray-400 mt-4">
          Acesso restrito ao pessoal autorizado
        </p>
      </div>
    </div>
  );
}
