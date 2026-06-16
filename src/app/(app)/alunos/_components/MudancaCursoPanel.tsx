"use client";
import { useActionState, useState } from "react";
import { transferirAluno, ascenderAluno } from "../actions";

type PlatoonOption = { id: string; name: string };
type CourseOption = { id: string; name: string; platoons: PlatoonOption[] };
type RemanescenteOption = CourseOption & { proximoNumero: string };

function abreviarPel(nome: string): string {
  return nome.replace(/Pelotão/gi, "Pel");
}

type Props = {
  studentId: string;
  currentCourseName: string;
  currentNumber: string;
  destinosRemanescente: RemanescenteOption[];
  destinosAscensao: CourseOption[];
};

type Aba = "ascensao" | "remanescente";

export default function MudancaCursoPanel({
  studentId,
  currentCourseName,
  currentNumber,
  destinosRemanescente,
  destinosAscensao,
}: Props) {
  const [aba, setAba] = useState<Aba>("ascensao");

  return (
    <div className="bg-white rounded-xl border border-gray-200 mt-6 overflow-hidden">
      <div className="px-6 pt-5">
        <h2 className="font-semibold text-gray-900">Mudança de curso</h2>
        <p className="text-xs text-gray-500">
          Curso atual: <strong>{currentCourseName}</strong> — Nº {currentNumber}
        </p>
      </div>

      {/* Abas */}
      <div className="flex gap-1 px-6 mt-4 border-b border-gray-200">
        <button
          type="button"
          onClick={() => setAba("ascensao")}
          className={`px-4 py-2 text-sm font-medium -mb-px border-b-2 transition-colors ${
            aba === "ascensao"
              ? "border-[#1e3a5f] text-[#1e3a5f]"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          Ascensão de curso
        </button>
        <button
          type="button"
          onClick={() => setAba("remanescente")}
          className={`px-4 py-2 text-sm font-medium -mb-px border-b-2 transition-colors ${
            aba === "remanescente"
              ? "border-[#1e3a5f] text-[#1e3a5f]"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          Transferência (Remanescente)
        </button>
      </div>

      <div className="p-6">
        {aba === "ascensao" ? (
          <AscensaoForm
            studentId={studentId}
            currentCourseName={currentCourseName}
            currentNumber={currentNumber}
            destinos={destinosAscensao}
          />
        ) : (
          <RemanescenteForm
            studentId={studentId}
            currentCourseName={currentCourseName}
            currentNumber={currentNumber}
            destinos={destinosRemanescente}
          />
        )}
      </div>
    </div>
  );
}

// ── Ascensão de curso (novo histórico, número escolhido pelo operador) ──────
type FormProps<T> = { studentId: string; currentCourseName: string; currentNumber: string; destinos: T[] };

function AscensaoForm({ studentId, currentCourseName, currentNumber, destinos }: FormProps<CourseOption>) {
  const action = ascenderAluno.bind(null, studentId);
  const [state, formAction, pending] = useActionState(action, undefined);
  const [destino, setDestino] = useState("");
  const [numero, setNumero] = useState("");
  const [platoonId, setPlatoonId] = useState("");

  const numeroPreview = numero.trim().replace(/^(\d+)(.*)$/, (_, d: string, r: string) => d.padStart(2, "0") + r);
  const cursoDestino = destinos.find((c) => c.id === destino);
  const pode = Boolean(destino) && Boolean(numero.trim());

  function handleDestino(id: string) {
    setDestino(id);
    setPlatoonId("");
  }

  return (
    <form action={formAction} className="space-y-4">
      <p className="text-xs text-gray-500">
        O aluno sobe para um curso de maior hierarquia (ex.: CFO 2 → CFO 3). Cria-se uma nova matrícula
        com <strong>histórico zerado (nota 10)</strong>; os dados pessoais e o login/senha são mantidos.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Novo curso *</label>
          <select
            name="destinoCourseId"
            value={destino}
            onChange={(e) => handleDestino(e.target.value)}
            required
            className="input"
          >
            <option value="" disabled>Selecione o curso de destino</option>
            {destinos.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Novo número *</label>
          <input
            name="novoNumero"
            value={numero}
            onChange={(e) => setNumero(e.target.value)}
            required
            className="input"
            placeholder="01"
          />
          {numero.trim() && (
            <p className="text-xs text-gray-500 mt-1">Será gravado como <strong>{numeroPreview}</strong></p>
          )}
        </div>
        <PlatoonSelect curso={cursoDestino} platoonId={platoonId} onChange={setPlatoonId} />
      </div>

      {destinos.length === 0 && (
        <p className="text-xs text-amber-600">
          Nenhum curso de destino disponível. Crie o curso na aba Cursos.
        </p>
      )}

      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}

      {pode && cursoDestino && (
        <div className="rounded-lg bg-blue-50 border border-blue-200 p-4 space-y-3">
          <p className="text-sm text-blue-800">
            Ascender <strong>{currentCourseName}</strong> Nº {currentNumber} para{" "}
            <strong>{cursoDestino.name}</strong> como Nº <strong>{numeroPreview}</strong>.
          </p>
          <p className="text-xs text-blue-700">
            A matrícula anterior fica preservada (acessível em &quot;Cadastros anteriores&quot;). O histórico do
            novo curso inicia zerado (nota 10).
          </p>
          <button type="submit" disabled={pending} className="btn-primary">
            {pending ? "Processando..." : "Ascender de curso"}
          </button>
        </div>
      )}
    </form>
  );
}

// ── Transferência remanescente (mesmo histórico, número automático -R) ──────
function RemanescenteForm({ studentId, currentCourseName, currentNumber, destinos }: FormProps<RemanescenteOption>) {
  const action = transferirAluno.bind(null, studentId);
  const [state, formAction, pending] = useActionState(action, undefined);
  const [destino, setDestino] = useState("");
  const [platoonId, setPlatoonId] = useState("");

  const destinoSelecionado = destinos.find((c) => c.id === destino);

  function handleDestino(id: string) {
    setDestino(id);
    setPlatoonId("");
  }

  return (
    <form action={formAction} className="space-y-4">
      <p className="text-xs text-gray-500">
        O aluno permanece sob o mesmo regime escolar. O <strong>histórico acompanha</strong> (comunicações
        publicadas e em trâmite). O número é atribuído automaticamente com o sufixo <strong>-R</strong>.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Curso remanescente *</label>
          <select
            name="destinoCourseId"
            value={destino}
            onChange={(e) => handleDestino(e.target.value)}
            required
            className="input"
          >
            <option value="" disabled>Selecione o curso remanescente</option>
            {destinos.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          {destinos.length === 0 && (
            <p className="text-xs text-amber-600 mt-1">
              Nenhum curso de destino disponível. Crie o curso remanescente na aba Cursos.
            </p>
          )}
        </div>
        <PlatoonSelect curso={destinoSelecionado} platoonId={platoonId} onChange={setPlatoonId} />
      </div>

      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}

      {destinoSelecionado && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 p-4 space-y-3">
          <p className="text-sm text-amber-800">
            Transferir <strong>{currentCourseName}</strong> Nº {currentNumber} para{" "}
            <strong>{destinoSelecionado.name}</strong>. O número será atribuído automaticamente como{" "}
            <strong>{destinoSelecionado.proximoNumero}</strong>.
          </p>
          <p className="text-xs text-amber-700">
            O histórico e as comunicações permanecem inalterados. A escola continua a mesma.
          </p>
          <button type="submit" disabled={pending} className="btn-primary">
            {pending ? "Transferindo..." : "Transferir de curso"}
          </button>
        </div>
      )}
    </form>
  );
}

// ── Seletor de pelotão do curso de destino ──────────────────────────────────
function PlatoonSelect({
  curso,
  platoonId,
  onChange,
}: {
  curso: CourseOption | undefined;
  platoonId: string;
  onChange: (id: string) => void;
}) {
  const platoons = curso?.platoons ?? [];
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">Pelotão</label>
      <select
        name="platoonId"
        value={platoonId}
        onChange={(e) => onChange(e.target.value)}
        disabled={!curso || platoons.length === 0}
        className="input"
      >
        <option value="">
          {!curso
            ? "Selecione o curso primeiro"
            : platoons.length === 0
            ? "Sem pelotões cadastrados"
            : "Sem pelotão"}
        </option>
        {platoons.map((p) => (
          <option key={p.id} value={p.id}>{abreviarPel(p.name)}</option>
        ))}
      </select>
    </div>
  );
}
