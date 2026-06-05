import { prisma } from "@/lib/db";
import { verifySession } from "@/lib/dal";
import { calcularNota, faixaNota, zonaDeRisco, STATUS_COM_PONTUACAO } from "@/lib/score";
import Link from "next/link";

// ── Dashboard do ALUNO ────────────────────────────────────────────────────
async function getDashboardAluno(email: string) {
  const aluno = await prisma.student.findFirst({
    where: { email },
    include: {
      course: true,
      platoon: true,
      communications: {
        include: { type: true },
        orderBy: { createdAt: "desc" },
      },
    },
  });
  if (!aluno) return null;

  const comms = aluno.communications;
  const comPontuacao = comms.filter(
    (c) => (STATUS_COM_PONTUACAO as readonly string[]).includes(c.status) && c.finalScore != null
  );

  return {
    aluno,
    nota: calcularNota(comPontuacao),
    pendenteCiencia: comms.filter((c) => c.status === "AGUARDANDO_CIENCIA").length,
    aguardandoDefesa: comms.filter((c) => c.status === "AGUARDANDO_DEFESA").length,
    prazoVencido: comms.filter((c) => c.status === "PRAZO_EXPIRADO").length,
    decididas: comPontuacao.length,
    favoraveis: comPontuacao.filter((c) => c.type.scoreNature === "FAVORAVEL").length,
    publicadas: comms.filter((c) => c.status === "PUBLICADA_CADERNO").length,
    totalCPIs: comms.filter((c) => c.type.name.startsWith("CPI")).length,
    pendentes: comms.filter((c) =>
      ["AGUARDANDO_CIENCIA", "AGUARDANDO_DEFESA", "PRAZO_EXPIRADO"].includes(c.status)
    ),
  };
}

// ── Dashboard geral (demais perfis) ──────────────────────────────────────
async function getDashboardGeral(role: string, userId: string) {
  const filtroReporter = role === "COMUNICANTE" ? { reporterId: userId } : {};

  const [
    totalCPIs,
    aguardandoCiencia,
    aguardandoDefesa,
    prazoVencido,
    aguardandoParecer,
    aguardandoDecisao,
    decididas,
    referencias,
    publicadas,
  ] = await Promise.all([
    prisma.communication.count({ where: { ...filtroReporter, type: { name: { in: ["CPI 0", "CPI 1", "CPI 2", "CPI 3"] } } } }),
    prisma.communication.count({ where: { ...filtroReporter, status: "AGUARDANDO_CIENCIA" } }),
    prisma.communication.count({ where: { ...filtroReporter, status: "AGUARDANDO_DEFESA" } }),
    prisma.communication.count({ where: { ...filtroReporter, status: "PRAZO_EXPIRADO" } }),
    prisma.communication.count({ where: { ...filtroReporter, status: "AGUARDANDO_PARECER" } }),
    prisma.communication.count({ where: { ...filtroReporter, status: "AGUARDANDO_DECISAO" } }),
    prisma.communication.count({ where: { ...filtroReporter, status: "DECIDIDA" } }),
    prisma.communication.count({ where: { ...filtroReporter, type: { name: "Referência Elogiosa" } } }),
    prisma.communication.count({ where: { ...filtroReporter, status: "PUBLICADA_CADERNO" } }),
  ]);

  const students = await prisma.student.findMany({
    where: { status: "ATIVO" },
    include: {
      communications: {
        where: { status: { in: [...STATUS_COM_PONTUACAO] }, finalScore: { not: null } },
        include: { type: true },
      },
    },
  });

  const studentsWithNota = students.map((s) => ({
    ...s,
    nota: calcularNota(s.communications),
  }));

  return {
    cards: { totalCPIs, aguardandoCiencia, aguardandoDefesa, prazoVencido, aguardandoParecer, aguardandoDecisao, decididas, referencias, publicadas },
    zonaRisco: studentsWithNota.filter((s) => zonaDeRisco(s.nota)),
  };
}

// ── Página ────────────────────────────────────────────────────────────────
export default async function DashboardPage() {
  const session = await verifySession();

  // ── PORTAL DO ALUNO ──────────────────────────────────────────────────────
  if (session.role === "ALUNO") {
    const dados = await getDashboardAluno(session.email);

    if (!dados) {
      return (
        <div className="p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Bem-vindo, {session.warName}</h1>
          <p className="text-gray-500">Nenhum aluno vinculado a este e-mail. Contate o Setor de Protocolo.</p>
        </div>
      );
    }

    const { aluno, nota, pendenteCiencia, aguardandoDefesa, prazoVencido, decididas, favoraveis, publicadas, totalCPIs, pendentes } = dados;
    const faixa = faixaNota(nota);
    const emRisco = zonaDeRisco(nota);

    return (
      <div className="p-6 max-w-3xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Olá, {aluno.warName}</h1>
          <p className="text-sm text-gray-500">{aluno.course.name} — Nº {aluno.courseNumber}{aluno.platoon ? ` — ${aluno.platoon.name}` : ""}</p>
        </div>

        {/* Nota da Disciplina */}
        <div className={`rounded-xl border p-5 mb-6 ${emRisco ? "border-red-300 bg-red-50" : "border-gray-200 bg-white"}`}>
          <p className="text-sm font-medium text-gray-500 mb-2">Nota da Disciplina — Conduta Profissional</p>
          <div className="flex items-center gap-4">
            <span className={`text-3xl font-bold px-4 py-2 rounded-xl ${faixa.tailwind}`}>
              {nota.toFixed(2)}
            </span>
            <div>
              <p className="font-semibold text-gray-900">{faixa.label}</p>
              {emRisco && nota >= 6 && (
                <p className="text-sm text-red-700 font-medium">⚠ Zona de risco — nota abaixo de 7,0</p>
              )}
              {nota < 6 && (
                <p className="text-sm text-red-900 font-bold">⛔ Reprovado — nota abaixo de 6,0</p>
              )}
              {!emRisco && (
                <p className="text-sm text-gray-500">Situação regular</p>
              )}
            </div>
          </div>
          <div className="flex gap-4 mt-3 text-xs text-gray-500">
            <span>Base: 10,00</span>
            <span className="text-red-600">{totalCPIs} CPI(s) registrada(s)</span>
            <span className="text-green-600">{favoraveis} registro(s) favorável(eis)</span>
          </div>
        </div>

        {/* Cards pessoais */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
          {[
            { label: "Aguardando minha ciência", value: pendenteCiencia, color: "bg-yellow-500", urgent: pendenteCiencia > 0 },
            { label: "Aguardando minha defesa", value: aguardandoDefesa, color: "bg-orange-500", urgent: aguardandoDefesa > 0 },
            { label: "Prazo de defesa vencido", value: prazoVencido, color: "bg-red-600", urgent: prazoVencido > 0 },
            { label: "Registros decididos", value: decididas, color: "bg-green-600", urgent: false },
            { label: "Registros favoráveis", value: favoraveis, color: "bg-teal-600", urgent: false },
            { label: "Publicados em Caderno", value: publicadas, color: "bg-gray-600", urgent: false },
          ].map((card) => (
            <div key={card.label} className={`${card.color} rounded-xl p-4 text-white ${card.urgent ? "ring-2 ring-white ring-offset-2" : ""}`}>
              <p className="text-3xl font-bold">{card.value}</p>
              <p className="text-xs mt-1 opacity-90">{card.label}</p>
            </div>
          ))}
        </div>

        {/* Pendências */}
        {pendentes.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
            <h2 className="text-base font-semibold text-gray-900 mb-3">Pendências — Ação necessária</h2>
            <div className="space-y-2">
              {pendentes.map((c) => (
                <Link
                  key={c.id}
                  href={`/comunicacoes/${c.id}`}
                  className="flex items-center justify-between px-4 py-3 rounded-lg border border-yellow-200 bg-yellow-50 hover:bg-yellow-100 transition-colors"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-900 font-mono">{c.protocolNumber}</p>
                    <p className="text-xs text-gray-500">{c.type.name}</p>
                  </div>
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                    c.status === "AGUARDANDO_CIENCIA" ? "bg-yellow-200 text-yellow-900" :
                    c.status === "PRAZO_EXPIRADO" ? "bg-red-200 text-red-900" :
                    "bg-orange-200 text-orange-900"
                  }`}>
                    {c.status === "AGUARDANDO_CIENCIA" ? "Aguardando sua ciência" :
                     c.status === "AGUARDANDO_DEFESA" ? "Aguardando sua defesa" :
                     "Prazo de defesa vencido"}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-3">
          <Link href="/comunicacoes" className="btn-secondary text-sm">Ver todas as comunicações</Link>
          <Link href={`/alunos/${aluno.id}/historico`} target="_blank" className="btn-secondary text-sm">Histórico / PDF</Link>
        </div>
      </div>
    );
  }

  // ── DASHBOARD GERAL (demais perfis) ──────────────────────────────────────
  const data = await getDashboardGeral(session.role, session.userId);
  const canCreate = session.role !== "ALUNO";

  const cards = [
    { label: "CPIs Registradas", value: data.cards.totalCPIs, color: "bg-blue-600" },
    { label: "Aguardando Ciência", value: data.cards.aguardandoCiencia, color: "bg-yellow-500" },
    { label: "Aguardando Defesa", value: data.cards.aguardandoDefesa, color: "bg-orange-500" },
    { label: "Prazo Vencido", value: data.cards.prazoVencido, color: "bg-red-600" },
    { label: "Aguardando Parecer", value: data.cards.aguardandoParecer, color: "bg-purple-600" },
    { label: "Aguardando Decisão", value: data.cards.aguardandoDecisao, color: "bg-indigo-600" },
    { label: "Decididas", value: data.cards.decididas, color: "bg-green-600" },
    { label: "Referências Elogiosas", value: data.cards.referencias, color: "bg-teal-600" },
    { label: "Publicadas em Caderno", value: data.cards.publicadas, color: "bg-gray-600" },
  ];

  const subtitulo: Record<string, string> = {
    COMUNICANTE: "Exibindo apenas as comunicações que você registrou",
    CHEFE_CURSO: "Visão geral do sistema",
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Painel de Controle</h1>
        <p className="text-sm text-gray-500">{subtitulo[session.role] ?? "Visão geral das comunicações em andamento"}</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 mb-8">
        {cards.map((card) => (
          <div key={card.label} className={`${card.color} rounded-xl p-4 text-white`}>
            <p className="text-3xl font-bold">{card.value}</p>
            <p className="text-xs mt-1 opacity-90">{card.label}</p>
          </div>
        ))}
      </div>

      {data.zonaRisco.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-5 mb-8">
          <h2 className="text-lg font-semibold text-red-800 mb-3">
            ⚠ Alunos em Zona de Risco (nota {"<"} 7,0)
          </h2>
          <div className="space-y-2">
            {data.zonaRisco.map((s) => {
              const faixa = faixaNota(s.nota);
              return (
                <Link
                  key={s.id}
                  href={`/alunos/${s.id}`}
                  className="flex items-center justify-between bg-white rounded-lg px-4 py-2 hover:bg-red-50 transition-colors"
                >
                  <span className="text-sm font-medium text-gray-900">{s.warName}</span>
                  <span className={`text-sm font-bold px-2 py-0.5 rounded ${faixa.tailwind}`}>
                    {s.nota.toFixed(2)}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {canCreate && (
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-base font-semibold text-gray-900 mb-3">Ações Rápidas</h2>
            <div className="space-y-2">
              <Link href="/comunicacoes/nova/cpi" className="block w-full text-left px-4 py-2.5 bg-[#1e3a5f] text-white rounded-lg text-sm hover:bg-[#16304f] transition-colors">
                + Nova CPI
              </Link>
              <Link href="/comunicacoes/nova/referencia" className="block w-full text-left px-4 py-2.5 border border-[#1e3a5f] text-[#1e3a5f] rounded-lg text-sm hover:bg-blue-50 transition-colors">
                + Nova Referência Elogiosa
              </Link>
              <Link href="/comunicacoes/nova/elogio-bi" className="block w-full text-left px-4 py-2.5 border border-green-600 text-green-700 rounded-lg text-sm hover:bg-green-50 transition-colors">
                + Elogio Publicado em BI <span className="text-xs font-normal opacity-70">(+1,0 pt)</span>
              </Link>
              <Link href="/alunos/novo" className="block w-full text-left px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50 transition-colors">
                + Cadastrar Aluno
              </Link>
            </div>
          </div>
        )}

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-base font-semibold text-gray-900 mb-3">Faixas de Nota — Conduta Profissional</h2>
          <div className="space-y-1.5 text-sm">
            {[
              { label: "≥ 9,0", tailwind: "bg-green-800 text-white", desc: "Excelente" },
              { label: "8,0 – 8,9", tailwind: "bg-green-500 text-white", desc: "Bom" },
              { label: "7,0 – 7,9", tailwind: "bg-yellow-400 text-black", desc: "Regular" },
              { label: "6,0 – 6,9", tailwind: "bg-red-400 text-white", desc: "Atenção" },
              { label: "< 6,0", tailwind: "bg-red-700 text-white", desc: "Reprovado" },
            ].map((f) => (
              <div key={f.label} className="flex items-center gap-3">
                <span className={`text-xs px-2 py-0.5 rounded font-bold ${f.tailwind} w-20 text-center`}>
                  {f.label}
                </span>
                <span className="text-gray-600">{f.desc}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
