"use client";
import { useActionState, useState } from "react";
import Image from "next/image";
import { login } from "./actions";

export default function LoginPage() {
  const [state, action, pending] = useActionState(login, undefined);
  const [mostrarAjuda, setMostrarAjuda] = useState(false);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#1e3a5f]">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <Image
              src="/brasao-apm.png"
              alt="Brasão APM/ES"
              width={120}
              height={140}
              className="object-contain drop-shadow-md"
              style={{ height: "auto" }}
              priority
            />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">SiGeCon</h1>
          <p className="text-sm text-gray-500 mt-1">Sistema de Gestão de Conduta</p>
          <p className="text-xs text-gray-400 mt-0.5">
            Academia de Polícia Militar do Espírito Santo — APM/ES
          </p>
        </div>

        <form action={action} className="space-y-5">
          <div>
            <label
              htmlFor="functionalNumber"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Número Funcional
            </label>
            <input
              id="functionalNumber"
              name="functionalNumber"
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
              <p className="font-medium text-gray-700">Senha do primeiro acesso:</p>
              <p className="text-gray-600 mt-0.5">
                A senha inicial é o <strong>Número Funcional + RG sem pontuação</strong>.
                Ex.: Funcional <em>123456</em> e RG <em>20.000-0</em> → senha <em>123456200000</em>.
              </p>
            </div>
            <div>
              <p className="font-medium text-gray-700">Esqueceu a senha após o primeiro acesso:</p>
              <p className="text-gray-600 mt-0.5">
                Entre em contato com o <strong>Administrador do Sistema</strong> ou com o{" "}
                <strong>Comandante da sua Escola</strong> para redefinição.
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
