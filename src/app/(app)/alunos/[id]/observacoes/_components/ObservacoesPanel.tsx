"use client";
import { useActionState, useEffect, useRef, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { criarObservacao, editarObservacao, type ObsState } from "../actions";

export type ObsItem = {
  id: string;
  nature: string;
  text: string;
  createdAt: string;
  editedAt: string | null;
  authorLabel: string;
  canEdit: boolean;
  attachments: { id: string; fileName: string }[];
};

const NATUREZA_META: Record<string, { label: string; badge: string; dot: string }> = {
  POSITIVA: { label: "Positiva", badge: "bg-green-100 text-green-800 border-green-200", dot: "bg-green-500" },
  NEGATIVA: { label: "Negativa", badge: "bg-red-100 text-red-800 border-red-200", dot: "bg-red-500" },
  NEUTRA:   { label: "Neutra",   badge: "bg-gray-100 text-gray-700 border-gray-200", dot: "bg-gray-400" },
};

const TIPOS_OK = ["image/png", "image/jpeg", "application/pdf"];

function useValidacaoArquivos() {
  const [arquivos, setArquivos] = useState<File[]>([]);
  const [erro, setErro] = useState("");
  const ref = useRef<HTMLInputElement>(null);
  function validar(files: FileList | null) {
    if (!files || files.length === 0) { setErro(""); setArquivos([]); return; }
    const lista = Array.from(files);
    for (const f of lista) {
      if (!TIPOS_OK.includes(f.type)) {
        setErro(`Formato inválido (${f.name}). Use PNG, JPEG ou PDF.`);
        setArquivos([]);
        if (ref.current) ref.current.value = "";
        return;
      }
    }
    const total = lista.reduce((s, f) => s + f.size, 0);
    if (total > 5 * 1024 * 1024) {
      setErro(`Total excede 5 MB (${(total / 1024 / 1024).toFixed(1)} MB).`);
      setArquivos([]);
      if (ref.current) ref.current.value = "";
      return;
    }
    setErro("");
    setArquivos(lista);
  }
  return { arquivos, erro, ref, validar };
}

type FormProps = {
  mode: "create" | "edit";
  studentId?: string;
  observation?: ObsItem;
  onDone: () => void;
};

function ObsForm({ mode, studentId, observation, onDone }: FormProps) {
  const action = mode === "create" ? criarObservacao : editarObservacao;
  const [state, formAction, pending] = useActionState<ObsState, FormData>(action, undefined);
  const [nature, setNature] = useState(observation?.nature ?? "");
  const { arquivos, erro: arquivoErro, ref: fileRef, validar } = useValidacaoArquivos();

  useEffect(() => {
    if (state && "ok" in state && state.ok) onDone();
  }, [state, onDone]);

  return (
    <form action={formAction} className="space-y-3 bg-slate-50 border border-slate-200 rounded-lg p-4">
      {mode === "create"
        ? <input type="hidden" name="studentId" value={studentId} />
        : <input type="hidden" name="observationId" value={observation!.id} />}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Natureza <span className="text-red-500">*</span>
        </label>
        <select
          name="nature"
          required
          className="input max-w-xs"
          value={nature}
          onChange={(e) => setNature(e.target.value)}
        >
          <option value="">Selecione</option>
          <option value="POSITIVA">Positiva</option>
          <option value="NEGATIVA">Negativa</option>
          <option value="NEUTRA">Neutra</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Observação <span className="text-red-500">*</span>
        </label>
        <textarea
          name="text"
          rows={5}
          required
          defaultValue={observation?.text ?? ""}
          placeholder="Descreva o fato relevante (positivo ou negativo) a registrar no histórico do aluno..."
          className="input"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Anexar documento(s){" "}
          <span className="text-gray-400 font-normal">(opcional — PNG, JPEG ou PDF — máx. 5 MB no total)</span>
        </label>
        <input
          ref={fileRef}
          type="file"
          name="file"
          accept=".png,.jpg,.jpeg,.pdf"
          multiple
          onChange={(e) => validar(e.target.files)}
          className="block w-full text-sm text-gray-700 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-[#1e3a5f] file:text-white hover:file:bg-[#162c48] cursor-pointer"
        />
        {arquivoErro && <p className="text-sm text-red-600 mt-1">{arquivoErro}</p>}
        {arquivos.length > 0 && !arquivoErro && (
          <div className="mt-1 space-y-0.5">
            {arquivos.map((f, i) => (
              <p key={i} className="text-sm text-green-700">✓ {f.name} ({(f.size / 1024 / 1024).toFixed(2)} MB)</p>
            ))}
          </div>
        )}
        {mode === "edit" && observation!.attachments.length > 0 && (
          <p className="text-xs text-gray-500 mt-1">Anexos existentes são mantidos; novos arquivos são adicionados.</p>
        )}
      </div>

      {state && "error" in state && <p className="text-sm text-red-600">{state.error}</p>}

      <div className="flex gap-2">
        <button type="submit" disabled={pending || !!arquivoErro} className="btn-primary">
          {pending ? "Salvando..." : mode === "create" ? "Incluir no histórico" : "Salvar alterações"}
        </button>
        <button type="button" onClick={onDone} className="btn-secondary">Cancelar</button>
      </div>
    </form>
  );
}

type Filtro = "TODAS" | "NEGATIVA" | "POSITIVA" | "NEUTRA";

export default function ObservacoesPanel({ studentId, observacoes }: { studentId: string; observacoes: ObsItem[] }) {
  const [adicionando, setAdicionando] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<Filtro>("TODAS");

  const counts = {
    NEGATIVA: observacoes.filter((o) => o.nature === "NEGATIVA").length,
    POSITIVA: observacoes.filter((o) => o.nature === "POSITIVA").length,
    NEUTRA: observacoes.filter((o) => o.nature === "NEUTRA").length,
  };
  const filtradas = filtro === "TODAS" ? observacoes : observacoes.filter((o) => o.nature === filtro);

  const pills: { key: Filtro; label: string; ativo: string }[] = [
    { key: "TODAS",    label: `Todas (${observacoes.length})`,   ativo: "bg-[#1e3a5f] text-white" },
    { key: "NEGATIVA", label: `Negativas (${counts.NEGATIVA})`,  ativo: "bg-red-600 text-white" },
    { key: "POSITIVA", label: `Positivas (${counts.POSITIVA})`,  ativo: "bg-green-600 text-white" },
    { key: "NEUTRA",   label: `Neutras (${counts.NEUTRA})`,      ativo: "bg-gray-500 text-white" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          {observacoes.length}{" "}
          {observacoes.length === 1 ? "observação registrada" : "observações registradas"}
        </p>
        {!adicionando && (
          <button onClick={() => { setAdicionando(true); setEditandoId(null); }} className="btn-primary text-sm">
            + Adicionar observação
          </button>
        )}
      </div>

      {observacoes.length > 0 && (
        <div className="flex gap-1.5 flex-wrap">
          {pills.map((p) => (
            <button
              key={p.key}
              onClick={() => setFiltro(p.key)}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                filtro === p.key ? p.ativo : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      )}

      {adicionando && (
        <ObsForm mode="create" studentId={studentId} onDone={() => setAdicionando(false)} />
      )}

      {observacoes.length === 0 && !adicionando && (
        <div className="bg-white border border-gray-200 rounded-xl p-8 text-center text-gray-400">
          Nenhuma observação registrada para este aluno.
        </div>
      )}

      {observacoes.length > 0 && filtradas.length === 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-6 text-center text-gray-400 text-sm">
          Nenhuma observação desta natureza.
        </div>
      )}

      <div className="space-y-3">
        {filtradas.map((o) => {
          const meta = NATUREZA_META[o.nature] ?? NATUREZA_META.NEUTRA;
          if (editandoId === o.id) {
            return <ObsForm key={o.id} mode="edit" observation={o} onDone={() => setEditandoId(null)} />;
          }
          return (
            <div key={o.id} className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="flex items-start justify-between gap-3 mb-2">
                <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full border ${meta.badge}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
                  {meta.label}
                </span>
                {o.canEdit && (
                  <button onClick={() => { setEditandoId(o.id); setAdicionando(false); }} className="text-xs text-[#1e3a5f] hover:underline">
                    Editar
                  </button>
                )}
              </div>
              <p className="text-sm text-gray-800 whitespace-pre-wrap">{o.text}</p>
              {o.attachments.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {o.attachments.map((a) => (
                    <a
                      key={a.id}
                      href={`/api/observacao-anexo/${a.id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs bg-gray-50 border border-gray-200 rounded px-2 py-1 text-[#1e3a5f] hover:bg-gray-100"
                    >
                      📎 {a.fileName}
                    </a>
                  ))}
                </div>
              )}
              <div className="mt-3 pt-2 border-t border-gray-100 text-xs text-gray-500">
                Registrada por <span className="font-medium text-gray-700">{o.authorLabel}</span> em{" "}
                {format(new Date(o.createdAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                {o.editedAt && (
                  <span className="text-gray-400"> · editada em {format(new Date(o.editedAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
