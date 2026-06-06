"use client";
import { useActionState, useState, useRef } from "react";
import {
  tomarCienciaComDefesa,
  tomarCienciaSemDefesa,
  emitirParecer,
  proferirDecisao,
} from "../actions";

type Sugestao = { titulo: string; texto: string };

const SUGESTOES_PARECER: Record<string, Sugestao[]> = {
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

const SUGESTOES_DECISAO: Record<string, Sugestao[]> = {
  "Punição": [
    {
      titulo: "Concisa",
      texto: "Após análise dos autos, do parecer emitido e da defesa apresentada, restou comprovada a prática da infração disciplinar. Decido pela aplicação de punição disciplinar, nos termos do regulamento vigente.",
    },
    {
      titulo: "Detalhada",
      texto: "Após análise criteriosa dos autos, considerando o relatório dos fatos, a defesa apresentada pelo aluno e o parecer emitido, constato que a infração disciplinar está devidamente comprovada e que as justificativas apresentadas não são suficientes para elidir a responsabilidade do infrator. A conduta praticada é incompatível com os princípios e normas que regem esta Instituição de Ensino. Decido pela aplicação de punição disciplinar, na forma prevista no regulamento, devendo a medida ser registrada nos assentamentos do aluno.",
    },
  ],
  "Arquivamento": [
    {
      titulo: "Concisa",
      texto: "Após análise dos autos e considerando o parecer emitido, não há elementos suficientes para a aplicação de sanção disciplinar. Decido pelo arquivamento da presente comunicação, sem prejuízo ao aluno.",
    },
    {
      titulo: "Detalhada",
      texto: "Após análise detalhada dos autos, considerando os fatos relatados, a defesa apresentada e o parecer emitido, verifico que as justificativas são procedentes e que os elementos colhidos não sustentam a aplicação de medida sancionatória. A instrução processual foi devidamente realizada e o resultado não evidencia infração passível de punição. Decido pelo arquivamento da presente comunicação, sem qualquer prejuízo ao histórico disciplinar do aluno.",
    },
  ],
  "Homologação (Referência Elogiosa)": [
    {
      titulo: "Concisa",
      texto: "Após análise dos autos, verifico que o comportamento do aluno é digno de reconhecimento formal. Decido pela homologação da Referência Elogiosa, que deverá ser registrada nos assentamentos do aluno.",
    },
    {
      titulo: "Detalhada",
      texto: "Após análise dos autos e do relatório dos fatos, verifico que o comportamento do aluno demonstra qualidades que enaltecem esta Instituição, sendo merecedor de reconhecimento formal. As circunstâncias narradas atendem plenamente aos critérios estabelecidos para a concessão de Referência Elogiosa. Decido pela homologação do registro, determinando que seja anotado nos assentamentos do aluno, como incentivo e reconhecimento pelo comportamento exemplar.",
    },
  ],
  "Reenquadrar artigo": [
    {
      titulo: "Concisa",
      texto: "Após análise dos autos e dos dispositivos regulamentares, verifico que a conduta praticada melhor se enquadra em artigo diverso do originalmente indicado. Decido pelo reenquadramento, devendo o processo prosseguir com a nova tipificação.",
    },
    {
      titulo: "Detalhada",
      texto: "Após análise detalhada dos autos e do cotejo com os dispositivos regulamentares vigentes, constato que a tipificação originalmente atribuída não corresponde com precisão ao dispositivo aplicável à conduta praticada. O reenquadramento faz-se necessário para assegurar a legalidade e a proporcionalidade da medida a ser adotada. Decido pelo reenquadramento do artigo, devendo o processo prosseguir sob a nova tipificação indicada.",
    },
  ],
};

type ManualRule = { id: string; article: string; item: string | null; letter: string | null; description: string };

type CommInfo = {
  id: string;
  status: string;
  defenseDeadline: string | null;
  studentId: string;
  finalScore: number | null;
  suggestedScore: number | null;
  opinions: { id: string }[];
};
type SessionInfo = { role: string; userId: string; email: string };

export default function AcoesComm({
  comm, session, studentEmail, alunoEhEssePerfil, manualRules,
}: {
  comm: CommInfo;
  session: SessionInfo;
  studentEmail: string;
  alunoEhEssePerfil: boolean;
  manualRules: ManualRule[];
}) {
  const [mostraDefesa, setMostraDefesa] = useState(false);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [arquivoErro, setArquivoErro] = useState("");
  const [decisaoTipo, setDecisaoTipo] = useState("");
  const [parecerRec, setParecerRec] = useState("");
  const [parecerTexto, setParecerTexto] = useState("");
  const [decisaoTexto, setDecisaoTexto] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const [defState, defAction, defPending] = useActionState(tomarCienciaComDefesa, undefined);
  const [semDefState, semDefAction, semDefPending] = useActionState(tomarCienciaSemDefesa, undefined);
  const [parecerState, parecerAction, parecerPending] = useActionState(emitirParecer, undefined);
  const [decisaoState, decisaoAction, decisaoPending] = useActionState(proferirDecisao, undefined);

  // Apenas o aluno pode tomar ciência/defesa
  const canTakeAck = alunoEhEssePerfil && comm.status === "AGUARDANDO_CIENCIA";
  // Subcomandante/Oficial emitem parecer assim que o aluno toma ciência (status AGUARDANDO_PARECER)
  const canEmitParecer =
    ["SUBCOMANDANTE_ESFAP", "SUBCOMANDANTE_ESFO", "OFICIAL_ESFAP", "OFICIAL_ESFO"].includes(session.role) &&
    comm.status === "AGUARDANDO_PARECER" &&
    comm.opinions.length === 0;
  const canDecide =
    ["ADMINISTRADOR", "COMANDANTE_ESFAP", "COMANDANTE_ESFO", "CHEFE_DIVISAO_ACADEMICA"].includes(session.role) &&
    comm.status === "AGUARDANDO_DECISAO";

  function validarArquivo(file: File | null) {
    if (!file) { setArquivoErro(""); setArquivo(null); return; }
    const tiposOk = ["image/png", "image/jpeg", "application/pdf"];
    if (!tiposOk.includes(file.type)) {
      setArquivoErro("Formato inválido. Use PNG, JPEG ou PDF.");
      setArquivo(null);
      if (fileRef.current) fileRef.current.value = "";
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setArquivoErro("Arquivo maior que 10 MB.");
      setArquivo(null);
      if (fileRef.current) fileRef.current.value = "";
      return;
    }
    setArquivoErro("");
    setArquivo(file);
  }

  return (
    <div className="space-y-4 mt-6">
      {/* ── CIÊNCIA DO ALUNO ─────────────────────────────────── */}
      {canTakeAck && !mostraDefesa && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-5">
          <h3 className="font-semibold text-yellow-900 mb-2">Ciência da Comunicação</h3>
          <p className="text-sm text-gray-600 mb-4">
            Você tem duas opções: apresentar sua justificativa/defesa ou apenas tomar ciência sem defesa.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              onClick={() => setMostraDefesa(true)}
              className="btn-primary text-sm"
            >
              Tomar ciência e apresentar defesa
            </button>

            <form action={semDefAction}>
              <input type="hidden" name="communicationId" value={comm.id} />
              <button
                type="submit"
                disabled={semDefPending}
                className="btn-secondary text-sm w-full sm:w-auto"
              >
                {semDefPending ? "Registrando..." : "Apenas tomar ciência (sem defesa)"}
              </button>
              {semDefState?.error && (
                <p className="text-sm text-red-600 mt-1">{semDefState.error}</p>
              )}
            </form>
          </div>

          <p className="text-xs text-gray-500 mt-3">
            <strong>Atenção:</strong> em ambos os casos, a comunicação será encaminhada automaticamente ao Subcomandante ou Oficial da Escola para emissão de parecer.
          </p>
        </div>
      )}

      {/* ── FORMULÁRIO DE DEFESA ─────────────────────────────── */}
      {canTakeAck && mostraDefesa && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-orange-900">Justificativa / Defesa</h3>
            <button
              type="button"
              onClick={() => { setMostraDefesa(false); setArquivo(null); setArquivoErro(""); }}
              className="text-xs text-gray-500 hover:text-gray-700"
            >
              ← Voltar
            </button>
          </div>

          <form action={defAction} className="space-y-4">
            <input type="hidden" name="communicationId" value={comm.id} />

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Texto da defesa <span className="text-red-500">*</span>
              </label>
              <textarea
                name="text"
                required
                rows={7}
                placeholder="Apresente aqui sua justificativa ou defesa de forma clara e objetiva..."
                className="input resize-y"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Anexar documento <span className="text-gray-400 font-normal">(opcional — PNG, JPEG ou PDF, máx. 10 MB)</span>
              </label>
              <input
                ref={fileRef}
                type="file"
                name="file"
                accept=".png,.jpg,.jpeg,.pdf"
                onChange={(e) => validarArquivo(e.target.files?.[0] ?? null)}
                className="block w-full text-sm text-gray-700 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-[#1e3a5f] file:text-white hover:file:bg-[#16304f] cursor-pointer"
              />
              {arquivoErro && (
                <p className="text-sm text-red-600 mt-1">{arquivoErro}</p>
              )}
              {arquivo && !arquivoErro && (
                <p className="text-sm text-green-700 mt-1">
                  ✓ {arquivo.name} ({(arquivo.size / 1024 / 1024).toFixed(2)} MB)
                </p>
              )}
            </div>

            {defState?.error && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
                {defState.error}
              </div>
            )}

            <div className="flex gap-3 pt-1">
              <button
                type="submit"
                disabled={defPending || !!arquivoErro}
                className="btn-primary"
              >
                {defPending ? "Enviando..." : "Enviar Defesa"}
              </button>
              <button
                type="button"
                onClick={() => { setMostraDefesa(false); setArquivo(null); setArquivoErro(""); }}
                className="btn-secondary"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── PARECER (Subcomandante / Oficial) ───────────────── */}
      {canEmitParecer && (
        <div className="bg-purple-50 border border-purple-200 rounded-xl p-5">
          <h3 className="font-semibold text-purple-900 mb-3">Emitir Parecer</h3>
          <form action={parecerAction} className="space-y-3">
            <input type="hidden" name="communicationId" value={comm.id} />

            {/* Recomendação primeiro — define as sugestões */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Recomendação <span className="text-red-500">*</span>
              </label>
              <select
                name="recommendation"
                className="input max-w-xs"
                value={parecerRec}
                onChange={(e) => setParecerRec(e.target.value)}
                required
              >
                <option value="">Selecione</option>
                <option value="Sugiro punição">Sugiro punição</option>
                <option value="Sugiro arquivamento">Sugiro arquivamento</option>
                <option value="Sugiro reenquadramento de artigo">Sugiro reenquadramento de artigo</option>
                <option value="Sugiro homologação (Referência Elogiosa)">Sugiro homologação (Referência Elogiosa)</option>
              </select>
            </div>

            {/* Sugestões de texto por tipo de recomendação */}
            {parecerRec && SUGESTOES_PARECER[parecerRec] && (
              <div className="bg-purple-100 border border-purple-200 rounded-lg p-3">
                <p className="text-xs font-semibold text-purple-800 mb-2">Sugestões de texto — clique para usar:</p>
                <div className="flex flex-col gap-2">
                  {SUGESTOES_PARECER[parecerRec].map((s, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setParecerTexto(s.texto)}
                      className="text-left text-xs bg-white border border-purple-200 rounded-lg px-3 py-2 hover:bg-purple-50 hover:border-purple-400 transition-colors"
                    >
                      <span className="font-semibold text-purple-700">{s.titulo}:</span>{" "}
                      <span className="text-gray-600 line-clamp-2">{s.texto.substring(0, 120)}…</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

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
                value={parecerTexto}
                onChange={(e) => setParecerTexto(e.target.value)}
              />
            </div>

            {parecerState?.error && (
              <p className="text-sm text-red-600">{parecerState.error}</p>
            )}
            <button type="submit" disabled={parecerPending} className="btn-primary">
              {parecerPending ? "Emitindo..." : "Emitir Parecer"}
            </button>
          </form>
        </div>
      )}

      {/* ── DECISÃO (Comandante) ─────────────────────────────── */}
      {canDecide && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-5">
          <h3 className="font-semibold text-green-900 mb-3">Decisão do Comandante da Escola</h3>
          <form action={decisaoAction} className="space-y-3">
            <input type="hidden" name="communicationId" value={comm.id} />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Decisão <span className="text-red-500">*</span>
              </label>
              <select
                name="decisionType"
                required
                className="input max-w-xs"
                value={decisaoTipo}
                onChange={(e) => setDecisaoTipo(e.target.value)}
              >
                <option value="">Selecione</option>
                <option value="Punição">Punição</option>
                <option value="Arquivamento">Arquivamento</option>
                <option value="Homologação (Referência Elogiosa)">Homologação (Referência Elogiosa)</option>
                <option value="Reenquadrar artigo">Reenquadrar artigo</option>
              </select>
            </div>

            {/* Seletor de novo artigo para reenquadramento */}
            {decisaoTipo === "Reenquadrar artigo" && (
              <div className="bg-white border border-gray-200 rounded-lg p-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Novo artigo do Manual do Aluno <span className="text-red-500">*</span>
                </label>
                <select name="newManualRuleId" required className="input">
                  <option value="">Selecione o artigo</option>
                  {manualRules.map((r) => (
                    <option key={r.id} value={r.id}>
                      Art. {r.article}{r.item ? ` — Inc. ${r.item}` : ""}{r.letter ? ` — Al. ${r.letter}` : ""} — {r.description}
                    </option>
                  ))}
                </select>
                {manualRules.length === 0 && (
                  <p className="text-xs text-red-500 mt-1">Nenhum artigo cadastrado no Manual do Aluno.</p>
                )}
              </div>
            )}

            {/* Sugestões de texto por tipo de decisão */}
            {decisaoTipo && SUGESTOES_DECISAO[decisaoTipo] && (
              <div className="bg-green-100 border border-green-200 rounded-lg p-3">
                <p className="text-xs font-semibold text-green-800 mb-2">Sugestões de texto — clique para usar:</p>
                <div className="flex flex-col gap-2">
                  {SUGESTOES_DECISAO[decisaoTipo].map((s, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setDecisaoTexto(s.texto)}
                      className="text-left text-xs bg-white border border-green-200 rounded-lg px-3 py-2 hover:bg-green-50 hover:border-green-400 transition-colors"
                    >
                      <span className="font-semibold text-green-700">{s.titulo}:</span>{" "}
                      <span className="text-gray-600 line-clamp-2">{s.texto.substring(0, 120)}…</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Fundamentação / Texto da Decisão <span className="text-red-500">*</span>
              </label>
              <textarea
                name="text"
                rows={6}
                required
                className="input"
                value={decisaoTexto}
                onChange={(e) => setDecisaoTexto(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Pontuação final aplicada
              </label>
              <input
                name="finalScore"
                type="number"
                step="0.1"
                min="0"
                defaultValue={comm.suggestedScore ?? ""}
                placeholder={comm.suggestedScore ? String(comm.suggestedScore) : "0.0"}
                className="input max-w-xs"
              />
              <p className="text-xs text-gray-400 mt-1">
                Deixe em branco para pontuação zero (ex: arquivamento, homologação de referência).
              </p>
            </div>
            {decisaoState?.error && (
              <p className="text-sm text-red-600">{decisaoState.error}</p>
            )}
            <button type="submit" disabled={decisaoPending} className="btn-primary">
              {decisaoPending ? "Registrando..." : "Registrar Decisão"}
            </button>
          </form>
        </div>
      )}

    </div>
  );
}
