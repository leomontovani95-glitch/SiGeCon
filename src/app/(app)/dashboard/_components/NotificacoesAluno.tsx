"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

type Notificacao = {
  id: string;
  protocolNumber: string;
  status: string;
  typeName: string;
  updatedAt: string;
};

const STATUS_LABELS: Record<string, string> = {
  AGUARDANDO_PARECER: "Encaminhado para parecer",
  AGUARDANDO_DECISAO: "Aguardando decisão do Cmt.",
  AGUARDANDO_DECISAO_DIVISAO: "Aguardando decisão da Div. Acadêmica",
  DECIDIDA:           "Decisão registrada",
  PUBLICADA_CADERNO:  "Publicado em caderno",
};

const STORAGE_KEY = "sigecon_notifs_dispensadas";

function getDismissed(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

function addDismissed(id: string) {
  try {
    const s = getDismissed();
    s.add(id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...s]));
  } catch {}
}

export default function NotificacoesAluno({ notificacoes }: { notificacoes: Notificacao[] }) {
  const router = useRouter();
  const [dispensadas, setDispensadas] = useState<Set<string>>(new Set());
  const [montado, setMontado] = useState(false);

  useEffect(() => {
    // Lê o localStorage só após montar para evitar mismatch de hidratação
    // (SSR não tem o estado de dispensadas). setState aqui é intencional.
    /* eslint-disable react-hooks/set-state-in-effect */
    setDispensadas(getDismissed());
    setMontado(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  const visiveis = notificacoes.filter((n) => !dispensadas.has(n.id));

  if (!montado || visiveis.length === 0) return null;

  function handleClick(id: string) {
    addDismissed(id);
    setDispensadas((prev) => new Set([...prev, id]));
    router.push(`/comunicacoes/${id}`);
  }

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-blue-900 flex items-center gap-2">
          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-600 text-white text-xs font-bold">
            {visiveis.length}
          </span>
          Tramitações Recentes
        </h2>
        <p className="text-xs text-blue-500 hidden sm:block">
          Clique para ver o registro e dispensar a notificação
        </p>
      </div>
      <div className="space-y-1.5">
        {visiveis.map((n) => (
          <button
            key={n.id}
            onClick={() => handleClick(n.id)}
            className="w-full text-left flex items-center justify-between px-4 py-2.5 rounded-lg bg-white border border-blue-100 hover:border-blue-300 hover:bg-blue-50 transition-colors group"
          >
            <div>
              <span className="text-sm font-medium text-gray-900 font-mono">{n.protocolNumber}</span>
              <span className="ml-2 text-xs text-gray-500">{n.typeName}</span>
              <p className="text-xs text-blue-700 font-medium mt-0.5">
                {STATUS_LABELS[n.status] ?? n.status}
              </p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span className="text-xs text-gray-400">
                {formatDistanceToNow(new Date(n.updatedAt), { addSuffix: true, locale: ptBR })}
              </span>
              <span className="text-xs text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity">
                Ver →
              </span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
