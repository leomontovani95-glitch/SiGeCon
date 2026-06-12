"use client";
import { useActionState, useState, useRef } from "react";
import {
  tomarCienciaComDefesa,
  tomarCienciaSemDefesa,
  tomarCienciaAdaptacao,
  proferirDecisao,
  corrigirPontuacao,
} from "../actions";

type Sugestao = { titulo: string; texto: string };

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

function pontuacaoPadrao(typeName: string, item: string | null): number | null {
  const name = typeName.toLowerCase();
  if (name.includes("referência elogiosa") || name.includes("referencia elogiosa")) return 0.2;
  if (name.startsWith("cpi")) {
    if (!item) return 0.1;
    if (item === "I") return 0.2;
    if (item === "II") return 0.4;
    if (item === "III") return 0.6;
    return 0.1;
  }
  return null;
}

function nomeCpiDoInciso(typeName: string, item: string | null): string {
  const name = typeName.toLowerCase();
  if (name.includes("referência elogiosa") || name.includes("referencia elogiosa")) return "Referência Elogiosa";
  if (!item) return "CPI 0";
  if (item === "I") return "CPI 1";
  if (item === "II") return "CPI 2";
  if (item === "III") return "CPI 3";
  return "CPI 0";
}

type ManualRule = { id: string; article: string; item: string | null; letter: string | null; description: string };

type CommInfo = {
  id: string;
  status: string;
  defenseDeadline: string | null;
  studentId: string;
  finalScore: number | null;
  suggestedScore: number | null;
  adaptationPeriod: boolean;
  opinions: { id: string }[];
  decisions: { id: string; finalScore: number | null; decisionType: string }[];
  typeName: string;
  item: string | null;
};
type SessionInfo = { role: string; userId: string; email: string };

export default function AcoesComm({
  comm, session, alunoEhEssePerfil, mostraFormDefesa, manualRules,
}: {
  comm: CommInfo;
  session: SessionInfo;
  alunoEhEssePerfil: boolean;
  mostraFormDefesa: boolean;
  manualRules: ManualRule[];
}) {
  const [arquivos, setArquivos] = useState<File[]>([]);
  const [arquivoErro, setArquivoErro] = useState("");
  const [arquivosDecisao, setArquivosDecisao] = useState<File[]>([]);
  const [arquivoErroDecisao, setArquivoErroDecisao] = useState("");
  const fileDecisaoRef = useRef<HTMLInputElement>(null);
  const [decisaoTipo, setDecisaoTipo] = useState("");
  const [decisaoTexto, setDecisaoTexto] = useState("");
  const [finalScoreDecisao, setFinalScoreDecisao] = useState<string>(() => {
    const def = pontuacaoPadrao(comm.typeName, comm.item);
    return def !== null ? def.toFixed(1) : "";
  });
  const [novoRuleId, setNovoRuleId] = useState<string>("");
  const [mostraCorrecao, setMostraCorrecao] = useState(false);
  const [novaPontuacao, setNovaPontuacao] = useState<string>("");
  const fileRef = useRef<HTMLInputElement>(null);

  const [defState, defAction, defPending] = useActionState(tomarCienciaComDefesa, undefined);
  const [semDefState, semDefAction, semDefPending] = useActionState(tomarCienciaSemDefesa, undefined);
  const [adaptacaoState, adaptacaoAction, adaptacaoPending] = useActionState(tomarCienciaAdaptacao, undefined);
  const [decisaoState, decisaoAction, decisaoPending] = useActionState(proferirDecisao, undefined);
  const [correcaoState, correcaoAction, correcaoPending] = useActionState(corrigirPontuacao, undefined);

  const canTakeAck = alunoEhEssePerfil && comm.status === "AGUARDANDO_CIENCIA";
  const canDecide =
    ["ADMINISTRADOR", "COMANDANTE_ESFAP", "COMANDANTE_ESFO", "CHEFE_DIVISAO_ACADEMICA"].includes(session.role) &&
    comm.status === "AGUARDANDO_DECISAO";
  const canEditScore =
    ["ADMINISTRADOR", "COMANDANTE_ESFAP", "COMANDANTE_ESFO", "CHEFE_DIVISAO_ACADEMICA"].includes(session.role) &&
    comm.decisions.length > 0;

  const baseUrl = `/comunicacoes/${comm.id}`;

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

  function validarArquivosDecisao(files: FileList | null) {
    if (!files || files.length === 0) { setArquivoErroDecisao(""); setArquivosDecisao([]); return; }
    const lista = Array.from(files);
    const tiposOk = ["image/png", "image/jpeg", "application/pdf"];
    for (const f of lista) {
      if (!tiposOk.includes(f.type)) {
        setArquivoErroDecisao(`Formato inválido (${f.name}). Use PNG, JPEG ou PDF.`);
        setArquivosDecisao([]);
        if (fileDecisaoRef.current) fileDecisaoRef.current.value = "";
        return;
      }
    }
    const totalBytes = lista.reduce((s, f) => s + f.size, 0);
    if (totalBytes > 5 * 1024 * 1024) {
      setArquivoErroDecisao(`Total excede 5 MB (${(totalBytes / 1024 / 1024).toFixed(1)} MB).`);
      setArquivosDecisao([]);
      if (fileDecisaoRef.current) fileDecisaoRef.current.value = "";
      return;
    }
    setArquivoErroDecisao("");
    setArquivosDecisao(lista);
  }

  return (
    <div className="space-y-4 mt-6">

      {/* ── OPÇÕES DE CIÊNCIA (antes de tomar ciência) ────────────── */}
      {canTakeAck && !mostraFormDefesa && comm.adaptationPeriod && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-5">
          <h3 className="font-semibold text-orange-900 mb-2">Ciência da Comunicação — Período de Adaptação</h3>
          <p className="text-sm text-orange-800 mb-3">
            Esta comunicação foi registrada durante o <strong>Período de Adaptação</strong>. A publicação não incidirá sobre a sua nota de conduta, independente do seu conteúdo.
          </p>
          <p className="text-sm text-gray-600 mb-4">
            Não há possibilidade de apresentar justificativa neste caso, pois não haverá desconto ou acréscimo de pontuação. Tome ciência para registrar o seu conhecimento da comunicação.
          </p>
          <form action={adaptacaoAction}>
            <input type="hidden" name="communicationId" value={comm.id} />
            <button
              type="submit"
              disabled={adaptacaoPending}
              className="btn-secondary text-sm"
            >
              {adaptacaoPending ? "Registrando..." : "Tomar Ciência"}
            </button>
          </form>
          {adaptacaoState?.error && (
            <p className="text-sm text-red-600 mt-2">{adaptacaoState.error}</p>
          )}
        </div>
      )}

      {canTakeAck && !mostraFormDefesa && !comm.adaptationPeriod && (comm.typeName.toLowerCase().includes("elogiosa")) && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-5">
          <h3 className="font-semibold text-green-900 mb-2">Ciência da Referência Elogiosa</h3>
          <p className="text-sm text-gray-600 mb-4">
            Esta é uma Referência Elogiosa. Tome ciência para registrar o seu conhecimento e encaminhar ao Oficial da Escola.
          </p>
          <form action={semDefAction}>
            <input type="hidden" name="communicationId" value={comm.id} />
            <button
              type="submit"
              disabled={semDefPending}
              className="btn-primary text-sm"
            >
              {semDefPending ? "Registrando..." : "Tomar Ciência"}
            </button>
            {semDefState?.error && (
              <p className="text-sm text-red-600 mt-1">{semDefState.error}</p>
            )}
          </form>
        </div>
      )}

      {canTakeAck && !mostraFormDefesa && !comm.adaptationPeriod && (!comm.typeName.toLowerCase().includes("elogiosa")) && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-5">
          <h3 className="font-semibold text-yellow-900 mb-2">Ciência da Comunicação</h3>
          <p className="text-sm text-gray-600 mb-4">
            Você tem duas opções: apresentar sua justificativa/defesa ou apenas tomar ciência sem defesa.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Link — troca para URL com ?defesa=1, sem dependência de React state */}
            <a href={`${baseUrl}?defesa=1`} className="btn-primary text-sm text-center">
              Tomar ciência e apresentar defesa
            </a>

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
      {canTakeAck && mostraFormDefesa && !comm.adaptationPeriod && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-orange-900">Justificativa / Defesa</h3>
            <a href={baseUrl} className="text-xs text-gray-500 hover:text-gray-700">
              ← Voltar
            </a>
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
                Anexar documento(s) <span className="text-gray-400 font-normal">(opcional — PNG, JPEG ou PDF — máx. 5 MB no total, múltiplos permitidos)</span>
              </label>
              <input
                ref={fileRef}
                type="file"
                name="file"
                accept=".png,.jpg,.jpeg,.pdf"
                multiple
                onChange={(e) => validarArquivos(e.target.files)}
                className="block w-full text-sm text-gray-700 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-[#1e3a5f] file:text-white hover:file:bg-[#16304f] cursor-pointer"
              />
              {arquivoErro && <p className="text-sm text-red-600 mt-1">{arquivoErro}</p>}
              {arquivos.length > 0 && !arquivoErro && (
                <div className="mt-1 space-y-0.5">
                  {arquivos.map((f, i) => (
                    <p key={i} className="text-sm text-green-700">
                      ✓ {f.name} ({(f.size / 1024 / 1024).toFixed(2)} MB)
                    </p>
                  ))}
                  <p className="text-xs text-gray-500">
                    Total: {(arquivos.reduce((s, f) => s + f.size, 0) / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
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
              <a href={baseUrl} className="btn-secondary">Cancelar</a>
            </div>
          </form>
        </div>
      )}

      {/* ── CORREÇÃO DE PONTUAÇÃO (após decisão) ────────────── */}
      {canEditScore && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-1">
            <h3 className="font-semibold text-yellow-900">Corrigir Pontuação Aplicada</h3>
            <button
              type="button"
              onClick={() => {
                if (!mostraCorrecao) {
                  const dec = comm.decisions[0];
                  setNovaPontuacao(dec.finalScore !== null ? dec.finalScore.toFixed(1) : "");
                }
                setMostraCorrecao(!mostraCorrecao);
              }}
              className="text-xs text-yellow-700 hover:text-yellow-900 underline"
            >
              {mostraCorrecao ? "Cancelar" : "Corrigir pontuação →"}
            </button>
          </div>
          {!mostraCorrecao && (
            <p className="text-xs text-gray-500">
              Pontuação atual: <strong>{comm.decisions[0]?.finalScore != null ? `${comm.decisions[0].finalScore.toFixed(1)} pt` : "—"}</strong>
            </p>
          )}
          {mostraCorrecao && (
            <form action={correcaoAction} className="space-y-3 mt-3">
              <input type="hidden" name="decisionId" value={comm.decisions[0].id} />
              <input type="hidden" name="communicationId" value={comm.id} />
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nova pontuação</label>
                <input
                  name="novaScore"
                  type="number"
                  step="0.1"
                  min="0"
                  value={novaPontuacao}
                  onChange={(e) => setNovaPontuacao(e.target.value)}
                  className="input max-w-xs"
                />
                {(() => {
                  const padrao = pontuacaoPadrao(comm.typeName, comm.item);
                  const atual = novaPontuacao !== "" ? Number(novaPontuacao) : null;
                  if (padrao !== null && atual !== null && Math.abs(atual - padrao) > 0.001) {
                    return (
                      <p className="text-xs text-red-600 mt-1 font-medium">
                        ⚠ Pontuação diferente do padrão {nomeCpiDoInciso(comm.typeName, comm.item)} ({padrao.toFixed(1)} pt)
                      </p>
                    );
                  }
                  return null;
                })()}
                <p className="text-xs text-gray-400 mt-1">
                  A correção será refletida automaticamente no caderno disciplinar.
                </p>
              </div>
              {correcaoState?.error && (
                <p className="text-sm text-red-600">{correcaoState.error}</p>
              )}
              <button type="submit" disabled={correcaoPending} className="btn-primary">
                {correcaoPending ? "Salvando..." : "Salvar Correção"}
              </button>
            </form>
          )}
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
                onChange={(e) => {
                  const tipo = e.target.value;
                  setDecisaoTipo(tipo);
                  setNovoRuleId("");
                  if (tipo !== "Reenquadrar artigo") {
                    const def = pontuacaoPadrao(comm.typeName, comm.item);
                    if (def !== null) setFinalScoreDecisao(def.toFixed(1));
                  }
                }}
              >
                <option value="">Selecione</option>
                <option value="Punição">Punição</option>
                <option value="Arquivamento">Arquivamento</option>
                <option value="Homologação (Referência Elogiosa)">Homologação (Referência Elogiosa)</option>
                <option value="Reenquadrar artigo">Reenquadrar artigo</option>
              </select>
            </div>

            {decisaoTipo === "Reenquadrar artigo" && (
              <div className="bg-white border border-gray-200 rounded-lg p-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Novo artigo do Manual do Aluno <span className="text-red-500">*</span>
                </label>
                <select
                  name="newManualRuleId"
                  required
                  className="input"
                  value={novoRuleId}
                  onChange={(e) => {
                    const selectedId = e.target.value;
                    setNovoRuleId(selectedId);
                    if (selectedId) {
                      const regra = manualRules.find((r) => r.id === selectedId);
                      if (regra) {
                        const newScore = pontuacaoPadrao(comm.typeName, regra.item);
                        if (newScore !== null) setFinalScoreDecisao(newScore.toFixed(1));
                      }
                    }
                  }}
                >
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
              <label className="block text-sm font-medium text-gray-700 mb-1">Pontuação final aplicada</label>
              <input
                name="finalScore"
                type="number"
                step="0.1"
                min="0"
                value={finalScoreDecisao}
                onChange={(e) => setFinalScoreDecisao(e.target.value)}
                className="input max-w-xs"
              />
              {(() => {
                const isReenq = decisaoTipo === "Reenquadrar artigo";
                if (isReenq && !novoRuleId) return null;
                const itemEfetivo = isReenq
                  ? (manualRules.find((r) => r.id === novoRuleId)?.item ?? null)
                  : comm.item;
                const padrao = pontuacaoPadrao(comm.typeName, itemEfetivo);
                const atual = finalScoreDecisao !== "" ? Number(finalScoreDecisao) : null;
                if (padrao !== null && atual !== null && Math.abs(atual - padrao) > 0.001) {
                  return (
                    <p className="text-xs text-red-600 mt-1 font-medium">
                      ⚠ Pontuação diferente do padrão {nomeCpiDoInciso(comm.typeName, itemEfetivo)} ({padrao.toFixed(1)} pt)
                    </p>
                  );
                }
                return null;
              })()}
              <p className="text-xs text-gray-400 mt-1">
                Deixe em branco para pontuação zero (ex: arquivamento).
              </p>
            </div>
            {/* Anexo(s) da decisão */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Anexar documento(s){" "}
                <span className="text-gray-400 font-normal">(opcional — PNG, JPEG ou PDF — máx. 5 MB no total)</span>
              </label>
              <input
                ref={fileDecisaoRef}
                type="file"
                name="fileDecisao"
                accept=".png,.jpg,.jpeg,.pdf"
                multiple
                onChange={(e) => validarArquivosDecisao(e.target.files)}
                className="block w-full text-sm text-gray-700 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-green-700 file:text-white hover:file:bg-green-800 cursor-pointer"
              />
              {arquivoErroDecisao && <p className="text-sm text-red-600 mt-1">{arquivoErroDecisao}</p>}
              {arquivosDecisao.length > 0 && !arquivoErroDecisao && (
                <div className="mt-1 space-y-0.5">
                  {arquivosDecisao.map((f, i) => (
                    <p key={i} className="text-sm text-green-700">✓ {f.name} ({(f.size / 1024 / 1024).toFixed(2)} MB)</p>
                  ))}
                  <p className="text-xs text-gray-500">
                    Total: {(arquivosDecisao.reduce((s, f) => s + f.size, 0) / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
              )}
            </div>

            {decisaoState?.error && (
              <p className="text-sm text-red-600">{decisaoState.error}</p>
            )}
            <button type="submit" disabled={decisaoPending || !!arquivoErroDecisao} className="btn-primary">
              {decisaoPending ? "Registrando..." : "Registrar Decisão"}
            </button>
          </form>
        </div>
      )}

    </div>
  );
}
