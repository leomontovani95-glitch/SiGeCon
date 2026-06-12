"use client";
import { useState, useTransition } from "react";
import { salvarAACP, type AACPSaveData } from "../aacp-actions";

// ── PeriodoInput ────────────────────────────────────────────────────────────
// Dois time-pickers que produzem "HHhMMmin – HHhMMmin" (ou "HHh" sem minutos)

function parseTimeStr(s: string): string {
  s = s.trim();
  const m1 = s.match(/^(\d{1,2})h(\d{2})min$/);
  if (m1) return `${m1[1].padStart(2, "0")}:${m1[2]}`;
  const m2 = s.match(/^(\d{1,2})h(\d{2})$/);
  if (m2) return `${m2[1].padStart(2, "0")}:${m2[2]}`;
  const m3 = s.match(/^(\d{1,2})h$/);
  if (m3) return `${m3[1].padStart(2, "0")}:00`;
  return "";
}

function formatTimeStr(t: string): string {
  if (!t) return "";
  const [hStr, mStr = "00"] = t.split(":");
  const h = hStr.padStart(2, "0");
  return mStr === "00" ? `${h}h` : `${h}h${mStr}min`;
}

function PeriodoInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const sep = /\s*[–\-]\s*/;
  const parts = value.split(sep);
  const startRaw = parseTimeStr(parts[0]?.trim() ?? "");
  const endRaw   = parseTimeStr(parts[1]?.trim() ?? "");

  const combine = (s: string, e: string) => {
    const sf = formatTimeStr(s);
    const ef = formatTimeStr(e);
    if (!sf && !ef) return "";
    if (!sf) return ef;
    if (!ef) return sf;
    return `${sf} – ${ef}`;
  };

  return (
    <div className="flex items-center gap-1 flex-nowrap">
      <input
        type="time"
        value={startRaw}
        onChange={e => onChange(combine(e.target.value, endRaw))}
        className="text-xs border border-gray-200 rounded px-1 py-0.5 w-[88px] focus:outline-none focus:border-[#1e3a5f]"
      />
      <span className="text-gray-400 text-xs select-none">–</span>
      <input
        type="time"
        value={endRaw}
        onChange={e => onChange(combine(startRaw, e.target.value))}
        className="text-xs border border-gray-200 rounded px-1 py-0.5 w-[88px] focus:outline-none focus:border-[#1e3a5f]"
      />
    </div>
  );
}

// ── Tipos ──────────────────────────────────────────────────────────────────

type ActionRow = { _key: string; acao: string; periodo: string };
type DayGroup  = { _key: string; day: "SABADO" | "DOMINGO"; cpiLabel: string; order: number; actions: ActionRow[] };
type ListItem  = { _key: string; text: string };

type FormState = {
  saturdayDate: string;
  sundayDate:   string;
  local:        string;
  fiscalizacao: string;
  versao:       number;
  dayGroups:    DayGroup[];
  materiais:    ListItem[];
  observacoes:  ListItem[];
  dispositivos: ListItem[];
};

export type AACPProps = {
  id: string;
  saturdayDate: string;
  sundayDate:   string;
  local:        string;
  fiscalizacao: string;
  versao:       number;
  dayGroups: {
    id: string; day: string; cpiLabel: string; order: number;
    actions: { id: string; acao: string; periodo: string; order: number }[];
  }[];
  materiais:          { id: string; text: string; order: number }[];
  observacoes:        { id: string; text: string; order: number }[];
  dispositivosLegais: { id: string; text: string; order: number }[];
};

// ── Helpers ────────────────────────────────────────────────────────────────

let _seq = 0;
function uid() { return `new-${++_seq}`; }

function initState(a: AACPProps): FormState {
  return {
    saturdayDate: a.saturdayDate,
    sundayDate:   a.sundayDate,
    local:        a.local,
    fiscalizacao: a.fiscalizacao,
    versao:       a.versao,
    dayGroups: [...a.dayGroups]
      .sort((x, y) => x.order - y.order)
      .map(g => ({
        _key: g.id, day: g.day as "SABADO" | "DOMINGO",
        cpiLabel: g.cpiLabel, order: g.order,
        actions: [...g.actions].sort((x, y) => x.order - y.order)
          .map(ac => ({ _key: ac.id, acao: ac.acao, periodo: ac.periodo })),
      })),
    materiais:    a.materiais.sort((x, y) => x.order - y.order).map(m => ({ _key: m.id, text: m.text })),
    observacoes:  a.observacoes.sort((x, y) => x.order - y.order).map(o => ({ _key: o.id, text: o.text })),
    dispositivos: a.dispositivosLegais.sort((x, y) => x.order - y.order).map(d => ({ _key: d.id, text: d.text })),
  };
}

function toSaveData(s: FormState): AACPSaveData {
  return {
    local: s.local, fiscalizacao: s.fiscalizacao, versao: s.versao,
    saturdayDate: s.saturdayDate, sundayDate: s.sundayDate,
    dayGroups: s.dayGroups.map((g, gi) => ({
      day: g.day, cpiLabel: g.cpiLabel, order: gi,
      actions: g.actions.map((a, ai) => ({ acao: a.acao, periodo: a.periodo, order: ai })),
    })),
    materiais:          s.materiais.map((m, i) => ({ text: m.text, order: i })),
    observacoes:        s.observacoes.map((o, i) => ({ text: o.text, order: i })),
    dispositivosLegais: s.dispositivos.map((d, i) => ({ text: d.text, order: i })),
  };
}

// ── Sub-componentes ────────────────────────────────────────────────────────

function EditableList({
  items, label, onAdd, onRemove, onEdit,
}: {
  items: ListItem[];
  label: string;
  onAdd: () => void;
  onRemove: (key: string) => void;
  onEdit: (key: string, text: string) => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">{label}</span>
        <button type="button" onClick={onAdd}
          className="text-xs text-[#1e3a5f] hover:underline font-medium">+ Adicionar</button>
      </div>
      <div className="space-y-1">
        {items.map(item => (
          <div key={item._key} className="flex items-start gap-1.5">
            <span className="text-gray-400 text-xs mt-2 select-none">—</span>
            <textarea
              rows={2}
              value={item.text}
              onChange={e => onEdit(item._key, e.target.value)}
              className="flex-1 text-xs border border-gray-200 rounded px-2 py-1 resize-none focus:outline-none focus:border-[#1e3a5f]"
            />
            <button type="button" onClick={() => onRemove(item._key)}
              className="text-gray-300 hover:text-red-500 text-sm mt-1.5 leading-none">×</button>
          </div>
        ))}
        {items.length === 0 && (
          <p className="text-xs text-gray-400 italic">Nenhum item. Clique em "+ Adicionar".</p>
        )}
      </div>
    </div>
  );
}

function DayGroupEditor({
  group, onUpdateCpi, onUpdateAcao, onUpdatePeriodo, onAddAction, onRemoveAction, onRemoveGroup,
}: {
  group: DayGroup;
  onUpdateCpi:     (cpiLabel: string) => void;
  onUpdateAcao:    (key: string, v: string) => void;
  onUpdatePeriodo: (key: string, v: string) => void;
  onAddAction:     () => void;
  onRemoveAction:  (key: string) => void;
  onRemoveGroup:   () => void;
}) {
  return (
    <div className="border border-gray-200 rounded-lg p-3 bg-gray-50">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs text-gray-500 font-medium">CPI:</span>
        <input
          type="text"
          value={group.cpiLabel}
          onChange={e => onUpdateCpi(e.target.value)}
          className="w-24 text-xs border border-gray-300 rounded px-2 py-0.5 font-semibold text-[#1e3a5f] focus:outline-none focus:border-[#1e3a5f]"
        />
        <button type="button" onClick={onRemoveGroup}
          className="ml-auto text-xs text-red-400 hover:text-red-600 hover:underline">Remover grupo</button>
      </div>

      {/* Cabeçalho das colunas */}
      <div className="flex items-center gap-2 text-xs text-gray-500 font-medium mb-1">
        <span className="flex-1">Ação</span>
        <span className="w-[200px] flex-shrink-0 text-center">Período (início – término)</span>
        <span className="w-5 flex-shrink-0" />
      </div>

      {/* Linhas de ação */}
      <div className="space-y-1.5 mb-2">
        {group.actions.map(ac => (
          <div key={ac._key} className="flex items-start gap-2">
            <textarea
              rows={2}
              value={ac.acao}
              onChange={e => onUpdateAcao(ac._key, e.target.value)}
              className="flex-1 min-w-0 border border-gray-200 rounded px-2 py-1 resize-none text-xs focus:outline-none focus:border-[#1e3a5f]"
            />
            <div className="w-[200px] flex-shrink-0 pt-1">
              <PeriodoInput value={ac.periodo} onChange={v => onUpdatePeriodo(ac._key, v)} />
            </div>
            <button type="button" onClick={() => onRemoveAction(ac._key)}
              className="w-5 flex-shrink-0 text-gray-300 hover:text-red-500 text-sm leading-none mt-2">×</button>
          </div>
        ))}
      </div>
      <button type="button" onClick={onAddAction}
        className="text-xs text-[#1e3a5f] hover:underline font-medium">+ Adicionar linha</button>
    </div>
  );
}

// ── Componente principal ───────────────────────────────────────────────────

export default function AACPEditor({ aacp }: { aacp: AACPProps }) {
  const [state, setState] = useState<FormState>(() => initState(aacp));
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  // ── helpers de mutação de estado ──────────────────────────────────────

  const updateMeta = (patch: Partial<Pick<FormState, "saturdayDate" | "sundayDate" | "local" | "fiscalizacao" | "versao">>) =>
    setState(s => ({ ...s, ...patch }));

  const updateGroupCpi = (key: string, cpiLabel: string) =>
    setState(s => ({ ...s, dayGroups: s.dayGroups.map(g => g._key === key ? { ...g, cpiLabel } : g) }));

  const addAction = (groupKey: string) =>
    setState(s => ({
      ...s,
      dayGroups: s.dayGroups.map(g =>
        g._key === groupKey
          ? { ...g, actions: [...g.actions, { _key: uid(), acao: "", periodo: "" }] }
          : g
      ),
    }));

  const removeAction = (groupKey: string, actionKey: string) =>
    setState(s => ({
      ...s,
      dayGroups: s.dayGroups.map(g =>
        g._key === groupKey
          ? { ...g, actions: g.actions.filter(a => a._key !== actionKey) }
          : g
      ),
    }));

  const updateAction = (groupKey: string, actionKey: string, field: "acao" | "periodo", value: string) =>
    setState(s => ({
      ...s,
      dayGroups: s.dayGroups.map(g =>
        g._key === groupKey
          ? { ...g, actions: g.actions.map(a => a._key === actionKey ? { ...a, [field]: value } : a) }
          : g
      ),
    }));

  const addGroup = (day: "SABADO" | "DOMINGO") =>
    setState(s => ({
      ...s,
      dayGroups: [
        ...s.dayGroups,
        { _key: uid(), day, cpiLabel: "", order: s.dayGroups.length, actions: [{ _key: uid(), acao: "", periodo: "" }] },
      ],
    }));

  const removeGroup = (key: string) =>
    setState(s => ({ ...s, dayGroups: s.dayGroups.filter(g => g._key !== key) }));

  const mkListHandlers = (field: "materiais" | "observacoes" | "dispositivos") => ({
    onAdd:    () => setState(s => ({ ...s, [field]: [...s[field], { _key: uid(), text: "" }] })),
    onRemove: (key: string) => setState(s => ({ ...s, [field]: s[field].filter((i: ListItem) => i._key !== key) })),
    onEdit:   (key: string, text: string) =>
      setState(s => ({ ...s, [field]: s[field].map((i: ListItem) => i._key === key ? { ...i, text } : i) })),
  });

  const handleSave = () => {
    setSaved(false);
    startTransition(async () => {
      await salvarAACP(aacp.id, toSaveData(state));
      setSaved(true);
    });
  };

  const sabGroups = state.dayGroups.filter(g => g.day === "SABADO");
  const domGroups = state.dayGroups.filter(g => g.day === "DOMINGO");

  const inputBase = "text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:outline-none focus:border-[#1e3a5f] focus:ring-1 focus:ring-[#1e3a5f]/30";

  return (
    <div className="space-y-6">

      {/* Metadados */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Data (sábado)</label>
          <input type="date" value={state.saturdayDate} onChange={e => updateMeta({ saturdayDate: e.target.value })} className={inputBase} />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Data (domingo)</label>
          <input type="date" value={state.sundayDate} onChange={e => updateMeta({ sundayDate: e.target.value })} className={inputBase} />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Fiscalização</label>
          <input type="text" value={state.fiscalizacao} onChange={e => updateMeta({ fiscalizacao: e.target.value })} className={`${inputBase} w-full`} />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Versão</label>
          <input type="number" min={1} value={state.versao} onChange={e => updateMeta({ versao: parseInt(e.target.value) || 1 })} className={`${inputBase} w-20`} />
        </div>
        <div className="col-span-2 sm:col-span-4">
          <label className="block text-xs font-medium text-gray-600 mb-1">Local de realização</label>
          <input type="text" value={state.local} onChange={e => updateMeta({ local: e.target.value })} className={`${inputBase} w-full`} />
        </div>
      </div>

      {/* Sábado */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-bold text-[#1e3a5f] uppercase tracking-wide">Sábado</h3>
          <button type="button" onClick={() => addGroup("SABADO")}
            className="text-xs text-[#1e3a5f] hover:underline font-medium">+ Adicionar grupo</button>
        </div>
        <div className="space-y-3">
          {sabGroups.map(g => (
            <DayGroupEditor key={g._key} group={g}
              onUpdateCpi={v => updateGroupCpi(g._key, v)}
              onUpdateAcao={(k, v) => updateAction(g._key, k, "acao", v)}
              onUpdatePeriodo={(k, v) => updateAction(g._key, k, "periodo", v)}
              onAddAction={() => addAction(g._key)}
              onRemoveAction={k => removeAction(g._key, k)}
              onRemoveGroup={() => removeGroup(g._key)}
            />
          ))}
          {sabGroups.length === 0 && (
            <p className="text-xs text-gray-400 italic">Nenhum grupo. Clique em "+ Adicionar grupo".</p>
          )}
        </div>
      </div>

      {/* Domingo */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-bold text-[#1e3a5f] uppercase tracking-wide">Domingo</h3>
          <button type="button" onClick={() => addGroup("DOMINGO")}
            className="text-xs text-[#1e3a5f] hover:underline font-medium">+ Adicionar grupo</button>
        </div>
        <div className="space-y-3">
          {domGroups.map(g => (
            <DayGroupEditor key={g._key} group={g}
              onUpdateCpi={v => updateGroupCpi(g._key, v)}
              onUpdateAcao={(k, v) => updateAction(g._key, k, "acao", v)}
              onUpdatePeriodo={(k, v) => updateAction(g._key, k, "periodo", v)}
              onAddAction={() => addAction(g._key)}
              onRemoveAction={k => removeAction(g._key, k)}
              onRemoveGroup={() => removeGroup(g._key)}
            />
          ))}
          {domGroups.length === 0 && (
            <p className="text-xs text-gray-400 italic">Nenhum grupo. Clique em "+ Adicionar grupo".</p>
          )}
        </div>
      </div>

      {/* Material necessário */}
      <EditableList items={state.materiais} label="Material necessário" {...mkListHandlers("materiais")} />

      {/* Observações */}
      <EditableList items={state.observacoes} label="Observações" {...mkListHandlers("observacoes")} />

      {/* Dispositivos legais */}
      <EditableList items={state.dispositivos} label="Dispositivos legais" {...mkListHandlers("dispositivos")} />

      {/* Botão salvar */}
      <div className="flex items-center gap-3 pt-2 border-t border-gray-100">
        <button
          type="button"
          onClick={handleSave}
          disabled={isPending}
          className="btn-primary text-sm disabled:opacity-50"
        >
          {isPending ? "Salvando…" : "Salvar AACP"}
        </button>
        {saved && !isPending && (
          <span className="text-xs text-green-600 font-medium">Salvo com sucesso.</span>
        )}
      </div>
    </div>
  );
}
