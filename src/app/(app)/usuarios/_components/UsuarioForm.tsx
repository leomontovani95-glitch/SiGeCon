"use client";
import { useActionState, useState } from "react";
import { salvarUsuario } from "../actions";

// Posto padrão sugerido por função (pode ser alterado manualmente)
const ROLE_DEFAULT_RANK: Record<string, string> = {
  COMANDANTE_APM:          "TEN CEL PM",
  SUBCOMANDANTE_APM:       "MAJ PM",
  CHEFE_DIVISAO_ACADEMICA: "MAJ PM",
  COMANDANTE_ESFAP:        "CAP PM",
  COMANDANTE_ESFO:         "CAP PM",
};

const ROLES = [
  { value: "ADMINISTRADOR",           label: "Administrador" },
  { value: "COMANDANTE_APM",          label: "Comandante da APM/ES" },
  { value: "SUBCOMANDANTE_APM",       label: "Subcomandante da APM/ES" },
  { value: "CHEFE_DIVISAO_ACADEMICA", label: "Chefe da Divisão Acadêmica" },
  { value: "COMANDANTE_ESFAP",        label: "Comandante da EsFAP" },
  { value: "COMANDANTE_ESFO",         label: "Comandante da EsFO" },
  { value: "SUBCOMANDANTE_ESFAP",     label: "Subcomandante da EsFAP" },
  { value: "SUBCOMANDANTE_ESFO",      label: "Subcomandante da EsFO" },
  { value: "OFICIAL_ESFAP",           label: "Oficial da EsFAP" },
  { value: "OFICIAL_ESFO",            label: "Oficial da EsFO" },
  { value: "CHEFE_CURSO",             label: "Chefe de Curso" },
  { value: "PROTOCOLO",               label: "Setor de Protocolo" },
  { value: "ALUNO",                   label: "Aluno" },
];

type Props = {
  defaultValues?: Record<string, string>;
  additionalRolesDefault?: string[];
  id?: string;
};

export default function UsuarioForm({ defaultValues, additionalRolesDefault = [], id }: Props) {
  const action = salvarUsuario.bind(null, id ?? null);
  const [state, formAction, pending] = useActionState(action, undefined);

  const [rank, setRank] = useState(defaultValues?.rank ?? "");

  function handleRoleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const suggestion = ROLE_DEFAULT_RANK[e.target.value];
    if (suggestion) setRank(suggestion);
  }

  return (
    <>
    {/* Campo dummy oculto para enganar o auto-fill do browser */}
    <div aria-hidden style={{ position: "absolute", opacity: 0, pointerEvents: "none", height: 0, overflow: "hidden" }}>
      <input type="text" name="_u" autoComplete="username" tabIndex={-1} />
      <input type="password" name="_p" autoComplete="current-password" tabIndex={-1} />
    </div>
    <form action={formAction} className="bg-white rounded-xl border border-gray-200 p-6 space-y-5" autoComplete="off">
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
          <label className="block text-sm font-medium text-gray-700 mb-1">Posto/Graduação *</label>
          <select name="rank" value={rank} onChange={(e) => setRank(e.target.value)} required className="input">
            <option value="" disabled>Selecione</option>
            <option>CEL PM</option>
            <option>TEN CEL PM</option>
            <option>MAJ PM</option>
            <option>CAP PM</option>
            <option>1º TEN PM</option>
            <option>2º TEN PM</option>
            <option>ASP OF PM</option>
            <option>SUBTEN PM</option>
            <option>1º SGT PM</option>
            <option>2º SGT PM</option>
            <option>3º SGT PM</option>
            <option>CB PM</option>
            <option>SD PM</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">RG *</label>
          <input name="rg" defaultValue={defaultValues?.rg} required className="input" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Número Funcional *</label>
          <input name="functionalNumber" defaultValue={defaultValues?.functionalNumber} required className="input" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">CPF *</label>
          <input name="cpf" defaultValue={defaultValues?.cpf} required className="input" placeholder="000.000.000-00" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">E-mail</label>
          <input
            name="email"
            type="email"
            defaultValue={defaultValues?.email ?? ""}
            className="input"
            autoComplete="off"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Senha{id ? " (deixe em branco para manter)" : " (deixe em branco para usar o nº funcional)"}
          </label>
          <input
            name="password"
            type="password"
            defaultValue=""
            className="input"
            autoComplete="new-password"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Função principal *</label>
          <select name="role" defaultValue={defaultValues?.role ?? "PROTOCOLO"} onChange={handleRoleChange} className="input">
            {ROLES.map((r) => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Escola *</label>
          <select name="escola" defaultValue={defaultValues?.escola ?? "TODAS"} required className="input">
            <option value="TODAS">Todas (EsFAP e EsFO)</option>
            <option value="ESFAP">EsFAP (CHS / CFSd)</option>
            <option value="ESFO">EsFO (CFO)</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Situação</label>
          <select name="active" defaultValue={defaultValues?.active ?? "true"} className="input">
            <option value="true">Ativo</option>
            <option value="false">Inativo</option>
          </select>
        </div>
      </div>

      {/* Funções adicionais */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Funções adicionais
          <span className="text-xs text-gray-400 font-normal ml-2">(para militares com mais de uma função no sistema)</span>
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {ROLES.map((r) => (
            <label key={r.value} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input
                type="checkbox"
                name="additionalRoles"
                value={r.value}
                defaultChecked={additionalRolesDefault.includes(r.value)}
                className="rounded border-gray-300 text-[#1e3a5f]"
              />
              {r.label}
            </label>
          ))}
        </div>
      </div>

      {state?.error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
          {state.error}
        </div>
      )}

      <div className="flex gap-3 pt-2">
        <button type="submit" disabled={pending} className="btn-primary">
          {pending ? "Salvando..." : "Salvar"}
        </button>
        <a href="/usuarios" className="btn-secondary">Cancelar</a>
      </div>
    </form>
    </>
  );
}
