"use client";
import { useActionState, useState, useRef } from "react";
import { emitirParecer } from "../actions";

type Sugestao = { titulo: string; texto: string };

const SUGESTOES: Record<string, Sugestao[]> = {
  "Sugiro punição": [
    {
      titulo: "Concisa",
      texto: "Analisados os fatos e os elementos constantes nos autos, verifico que a infração disciplinar está devidamente comprovada, não havendo justificativa suficiente a elidir a conduta irregular. Manifesto-me pelo sancionamento disciplinar do aluno.",
    },
    {
      titulo: "Detalhada",
      texto: "Após análise criteriosa dos fatos relatados, dos documentos constantes nos autos e da defesa apresentada pelo aluno, verifico que a conduta praticada contraria as normas disciplinares vigentes nesta Escola. A prova colhida é robusta e a justificativa apresentada não foi suficiente para desconstituir a irregularidade apurada. Diante do exposto, manifesto-me pelo sancionamento disciplinar, na forma regulamentar.",
    },
  ],
  "Sugiro arquivamento": [
    {
      titulo: "Concisa",
      texto: "Analisados os fatos e as justificativas apresentadas, constato que os elementos dos autos não são suficientes para a aplicação de sanção disciplinar. Manifesto-me pelo arquivamento da presente comunicação.",
    },
    {
      titulo: "Detalhada",
      texto: "Após análise dos fatos relatados e da defesa apresentada pelo aluno, verifico que as justificativas são procedentes e os elementos constantes nos autos não sustentam a aplicação de medida sancionatória. A conduta, embora passível de registro, não reúne os requisitos necessários para ensejar punição disciplinar. Diante do exposto, manifesto-me pelo arquivamento da presente comunicação.",
    },
  ],
  "Sugiro reenquadramento de artigo": [
    {
      titulo: "Concisa",
      texto: "Após análise dos fatos e dos dispositivos regulamentares aplicáveis, verifico que a conduta relatada melhor se enquadra em artigo diverso do originalmente indicado. Manifesto-me pelo reenquadramento, conforme fundamentos acima.",
    },
    {
      titulo: "Detalhada",
      texto: "Após análise detalhada dos fatos narrados e do cotejo com os dispositivos regulamentares vigentes, verifico que a tipificação originalmente atribuída à conduta não corresponde com precisão ao dispositivo aplicável. A conduta praticada encontra melhor enquadramento em artigo diverso, que prevê a infração de forma mais específica. Manifesto-me pelo reenquadramento do artigo, com o prosseguimento do processo sob a nova tipificação.",
    },
  ],
  "Sugiro homologação (Referência Elogiosa)": [
    {
      titulo: "Concisa",
      texto: "Analisados os fatos e os elementos constantes nos autos, verifico que o comportamento do aluno é digno de reconhecimento formal. Manifesto-me pela homologação da Referência Elogiosa.",
    },
    {
      titulo: "Detalhada",
      texto: "Após análise dos fatos relatados e dos elementos constantes nos autos, verifico que o comportamento do aluno destaca-se positivamente, demonstrando dedicação, comprometimento e conduta exemplar no âmbito desta Escola. As circunstâncias narradas atendem plenamente aos requisitos para o reconhecimento formal. Diante do exposto, manifesto-me pela homologação da Referência Elogiosa, que deverá ser anotada nos assentamentos do aluno.",
    },
  ],
};

type ManualRule = { id: string; article: string; item: string | null; letter: string | null; description: string };
type Props = { communicationId: string; manualRules: ManualRule[] };

export default function ParecerForm({ communicationId, manualRules }: Props) {
  const [state, formAction, pending] = useActionState(emitirParecer, undefined);
  const [recomendacao, setRecomendacao] = useState("");
  const [texto, setTexto] = useState("");
  const [ruleId, setRuleId] = useState("");
  const [arquivos, setArquivos] = useState<File[]>([]);
  const [arquivoErro, setArquivoErro] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  function validarArquivos(files: FileList | null) {
    if (!files || files.length === 0) { setArquivoErro(""); setArquivos([]); return; }
    const lista = Array.from(files);
    const tiposOk = ["image/png", "image/jpeg", "application/pdf"];
    for (const f of lista) {
      if (!tiposOk.includes(f.type)) {
        setArquivoErro(`Formato inválido (${f.name}). Use PNG, JPEG ou PDF.`);
        setArquivos([]);
        if (fileRef.current) fileRef.current.value = "";
        return;
      }
    }
    const totalBytes = lista.reduce((s, f) => s + f.size, 0);
    if (totalBytes > 5 * 1024 * 1024) {
      setArquivoErro(`Total excede 5 MB (${(totalBytes / 1024 / 1024).toFixed(1)} MB).`);
      setArquivos([]);
      if (fileRef.current) fileRef.current.value = "";
      return;
    }
    setArquivoErro("");
    setArquivos(lista);
  }

  const sugestoes = SUGESTOES[recomendacao] ?? [];
  const isReenquadramento = recomendacao === "Sugiro reenquadramento de artigo";

  return (
    <div className="bg-purple-50 border border-purple-200 rounded-xl p-5 mt-4">
      <h3 className="font-semibold text-purple-900 mb-3">Emitir Parecer</h3>
      <form action={formAction} className="space-y-4">
        <input type="hidden" name="communicationId" value={communicationId} />

        {/* Recomendação */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Recomendação <span className="text-red-500">*</span>
          </label>
          <select
            name="recommendation"
            required
            className="input max-w-xs"
            value={recomendacao}
            onChange={(e) => { setRecomendacao(e.target.value); setRuleId(""); }}
          >
            <option value="">Selecione</option>
            <option value="Sugiro punição">Sugiro punição</option>
            <option value="Sugiro arquivamento">Sugiro arquivamento</option>
            <option value="Sugiro reenquadramento de artigo">Sugiro reenquadramento de artigo</option>
            <option value="Sugiro homologação (Referência Elogiosa)">Sugiro homologação (Referência Elogiosa)</option>
          </select>
        </div>

        {/* Artigo sugerido para reenquadramento */}
        {isReenquadramento && (
          <div className="bg-white border border-purple-200 rounded-lg p-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Artigo sugerido para reenquadramento <span className="text-red-500">*</span>
            </label>
            <select
              name="newManualRuleIdParecer"
              required
              className="input"
              value={ruleId}
              onChange={(e) => setRuleId(e.target.value)}
            >
              <option value="">Selecione o artigo sugerido</option>
              {manualRules.map((r) => (
                <option key={r.id} value={r.id}>
                  Art. {r.article}{r.item ? ` — Inc. ${r.item}` : ""}{r.letter ? ` — Al. ${r.letter}` : ""} — {r.description}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Sugestões de texto */}
        {sugestoes.length > 0 && (
          <div className="bg-purple-100 border border-purple-200 rounded-lg p-3">
            <p className="text-xs font-semibold text-purple-800 mb-2">Sugestões de texto — clique para usar:</p>
            <div className="flex flex-col gap-2">
              {sugestoes.map((s, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setTexto(s.texto)}
                  className="text-left text-xs bg-white border border-purple-200 rounded-lg px-3 py-2 hover:bg-purple-50 hover:border-purple-400 transition-colors"
                >
                  <span className="font-semibold text-purple-700">{s.titulo}:</span>{" "}
                  <span className="text-gray-600">{s.texto.substring(0, 130)}…</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Texto do parecer */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Texto do Parecer <span className="text-red-500">*</span>
          </label>
          <textarea
            name="text"
            rows={6}
            required
            placeholder="Análise dos fatos, da defesa (quando houver) e fundamentação..."
            className="input"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
          />
        </div>

        {/* Anexo(s) */}
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
            onChange={(e) => validarArquivos(e.target.files)}
            className="block w-full text-sm text-gray-700 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-purple-700 file:text-white hover:file:bg-purple-800 cursor-pointer"
          />
          {arquivoErro && <p className="text-sm text-red-600 mt-1">{arquivoErro}</p>}
          {arquivos.length > 0 && !arquivoErro && (
            <div className="mt-1 space-y-0.5">
              {arquivos.map((f, i) => (
                <p key={i} className="text-sm text-green-700">✓ {f.name} ({(f.size / 1024 / 1024).toFixed(2)} MB)</p>
              ))}
              <p className="text-xs text-gray-500">
                Total: {(arquivos.reduce((s, f) => s + f.size, 0) / 1024 / 1024).toFixed(2)} MB
              </p>
            </div>
          )}
        </div>

        {state?.error && <p className="text-sm text-red-600">{state.error}</p>}

        <button type="submit" disabled={pending || !!arquivoErro} className="btn-primary">
          {pending ? "Emitindo..." : "Emitir Parecer"}
        </button>
      </form>
    </div>
  );
}
