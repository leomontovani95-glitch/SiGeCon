import { prisma } from "@/lib/db";
import { verifySession, getSchoolFilter } from "@/lib/dal";
import { calcularNotaPublicada, faixaNota, zonaDeRisco } from "@/lib/score";
import Link from "next/link";

// ── Dashboard do ALUNO ────────────────────────────────────────────────────
async function getDashboardAluno(userId: string) {
  const aluno = await prisma.student.findFirst({
    where: { userId },
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

  const pubItems = await prisma.disciplinaryBookItem.findMany({
    where: { studentId: aluno.id, disciplinaryBook: { status: "PUBLICADO" } },
    include: { communication: { include: { type: { select: { scoreNature: true } } } } },
  });

  const comms = aluno.communications;
  const favoraveisPublicados = pubItems.filter((i) => i.communication.type.scoreNature === "FAVORAVEL").length;

  return {
    aluno,
    nota: calcularNotaPublicada(pubItems),
    pendenteCiencia: comms.filter((c) => c.status === "AGUARDANDO_CIENCIA" || c.status === "AGUARDANDO_DEFESA").length,
    aguardandoDefesa: 0,
    prazoVencido: comms.filter((c) => c.status === "PRAZO_EXPIRADO").length,
    decididas: pubItems.length,
    favoraveis: favoraveisPublicados,
    publicadas: pubItems.length,
    totalCPIs: comms.filter((c) => c.type.name.startsWith("CPI")).length,
    pendentes: comms.filter((c) =>
      ["AGUARDANDO_CIENCIA", "AGUARDANDO_DEFESA", "PRAZO_EXPIRADO"].includes(c.status)
    ),
  };
}

// ── Dashboard geral — recebe os IDs de cursos no escopo ──────────────────
async function getDashboardGeral(
  role: string,
  userId: string,
  scopeCourseIds: string[],
) {
  const filtroReporter = role === "COMUNICANTE" ? { reporterId: userId } : {};
  // Filtro de curso: se scopeCourseIds for vazio, nada é exibido (fallback seguro)
  const cf = scopeCourseIds.length > 0 ? { courseId: { in: scopeCourseIds } } : {};

  const [
    totalCPIs,
    aguardandoCiencia,
    aguardandoDefesa,
    prazoVencido,
    aguardandoParecer,
    aguardandoDecisao,
    // CPIs com decisão do Comandante que ainda não foram publicadas em caderno publicado
    cpisDecididasAgPublicacao,
    referencias,
    cadernosPublicados,
  ] = await Promise.all([
    // CPIs ainda em trâmite (sem caderno publicado)
    prisma.communication.count({ where: {
      ...filtroReporter, ...cf,
      type: { name: { in: ["CPI 0","CPI 1","CPI 2","CPI 3"] } },
      disciplinaryBookItems: { none: { disciplinaryBook: { status: "PUBLICADO" } } },
    } }),
    prisma.communication.count({ where: { ...filtroReporter, ...cf, status: "AGUARDANDO_CIENCIA" } }),
    prisma.communication.count({ where: { ...filtroReporter, ...cf, status: "AGUARDANDO_DEFESA" } }),
    prisma.communication.count({ where: { ...filtroReporter, ...cf, status: "PRAZO_EXPIRADO" } }),
    prisma.communication.count({ where: { ...filtroReporter, ...cf, status: "AGUARDANDO_PARECER" } }),
    prisma.communication.count({ where: { ...filtroReporter, ...cf, status: "AGUARDANDO_DECISAO" } }),
    prisma.communication.count({ where: {
      ...filtroReporter, ...cf,
      status: "DECIDIDA",
      type: { name: { in: ["CPI 0","CPI 1","CPI 2","CPI 3"] } },
      disciplinaryBookItems: { none: { disciplinaryBook: { status: "PUBLICADO" } } },
    } }),
    // Refs/Elogios ainda em trâmite (sem caderno publicado)
    prisma.communication.count({ where: {
      ...filtroReporter, ...cf,
      type: { name: { in: ["Referência Elogiosa", "Elogio publicado em BI"] } },
      disciplinaryBookItems: { none: { disciplinaryBook: { status: "PUBLICADO" } } },
    } }),
    prisma.disciplinaryBook.count({ where: { status: "PUBLICADO", ...(scopeCourseIds.length ? { courseId: { in: scopeCourseIds } } : {}) } }),
  ]);

  const [students, allPubItems] = await Promise.all([
    prisma.student.findMany({ where: { status: "ATIVO", ...cf } }),
    prisma.disciplinaryBookItem.findMany({
      where: { disciplinaryBook: { status: "PUBLICADO" }, ...(scopeCourseIds.length ? { courseId: { in: scopeCourseIds } } : {}) },
      include: { communication: { include: { type: { select: { scoreNature: true } } } } },
    }),
  ]);

  // Arquivado = decisão do Comandante foi arquivar (sem desconto/acréscimo de pontos)
  const isArquivado = (summary: string | null) =>
    (summary ?? "").toLowerCase().includes("arquiv");

  // CPIs publicadas em caderno com SANÇÃO confirmada (pontos descontados)
  const cpisPublicadas      = allPubItems.filter(i => i.recordType.startsWith("CPI") && !isArquivado(i.decisionSummary)).length;
  // CPIs publicadas em caderno com decisão de ARQUIVAR (sem desconto)
  const cpisArquivadas      = allPubItems.filter(i => i.recordType.startsWith("CPI") &&  isArquivado(i.decisionSummary)).length;
  // RE/EBI publicados em caderno com decisão FAVORÁVEL (pontos somados)
  const elogiososPublicados = allPubItems.filter(i =>
    (i.recordType === "Referência Elogiosa" || i.recordType === "Elogio publicado em BI") && !isArquivado(i.decisionSummary)
  ).length;
  // RE/EBI publicados em caderno com decisão de ARQUIVAR (sem acréscimo)
  const elogiososArquivados = allPubItems.filter(i =>
    (i.recordType === "Referência Elogiosa" || i.recordType === "Elogio publicado em BI") &&  isArquivado(i.decisionSummary)
  ).length;

  const pubPorAluno = new Map<string, typeof allPubItems>();
  for (const item of allPubItems) {
    if (!pubPorAluno.has(item.studentId)) pubPorAluno.set(item.studentId, []);
    pubPorAluno.get(item.studentId)!.push(item);
  }

  const studentsWithNota = students.map((s) => ({
    ...s,
    nota: calcularNotaPublicada(pubPorAluno.get(s.id) ?? []),
  }));

  return {
    cards: {
      totalCPIs,
      aguardandoCienciaDefesa: aguardandoCiencia + aguardandoDefesa,
      prazoVencido, aguardandoParecer, aguardandoDecisao,
      cpisDecididasAgPublicacao,
      referencias,
      cpisPublicadas, elogiososPublicados, cadernosPublicados,
      cpisArquivadas, elogiososArquivados,
    },
    zonaRisco: studentsWithNota.filter((s) => zonaDeRisco(s.nota)),
  };
}

// ── Página ────────────────────────────────────────────────────────────────
export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const session = await verifySession();

  // ── PORTAL DO ALUNO ──────────────────────────────────────────────────────
  if (session.role === "ALUNO") {
    const dados = await getDashboardAluno(session.userId);

    if (!dados) {
      return (
        <div className="p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Bem-vindo, {session.warName}</h1>
          <p className="text-gray-500">Nenhum aluno vinculado a este e-mail. Contate o Setor de Protocolo.</p>
        </div>
      );
    }

    const { aluno, nota, pendenteCiencia, prazoVencido, decididas, favoraveis, publicadas, totalCPIs, pendentes } = dados;
    const faixa = faixaNota(nota);
    const emRisco = zonaDeRisco(nota);

    return (
      <div className="p-6 max-w-3xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Olá, {aluno.warName}</h1>
          <p className="text-sm text-gray-500">{aluno.course.name} — Nº {aluno.courseNumber}{aluno.platoon ? ` — ${aluno.platoon.name}` : ""}</p>
        </div>

        <div className={`rounded-xl border p-5 mb-6 ${emRisco ? "border-red-300 bg-red-50" : "border-gray-200 bg-white"}`}>
          <p className="text-sm font-medium text-gray-500 mb-2">Nota da Disciplina — Conduta Profissional</p>
          <div className="flex items-center gap-4">
            <span className={`text-3xl font-bold px-4 py-2 rounded-xl ${faixa.tailwind}`}>{nota.toFixed(2)}</span>
            <div>
              <p className="font-semibold text-gray-900">{faixa.label}</p>
              {emRisco && nota >= 6 && <p className="text-sm text-red-700 font-medium">⚠ Zona de risco — nota abaixo de 7,0</p>}
              {nota < 6 && <p className="text-sm text-red-900 font-bold">⛔ Reprovado — nota abaixo de 6,0</p>}
              {!emRisco && <p className="text-sm text-gray-500">Situação regular</p>}
            </div>
          </div>
          <div className="flex gap-4 mt-3 text-xs text-gray-500">
            <span>Base: 10,00</span>
            <span className="text-red-600">{totalCPIs} CPI(s) registrada(s)</span>
            <span className="text-green-600">{favoraveis} registro(s) favorável(eis)</span>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
          {[
            { label: "Aguardando minha ciência/defesa", value: pendenteCiencia, color: "bg-yellow-500", urgent: pendenteCiencia > 0 },
            { label: "Prazo de defesa vencido",         value: prazoVencido,    color: "bg-red-600",    urgent: prazoVencido > 0 },
            { label: "Registros decididos",             value: decididas,       color: "bg-green-600",  urgent: false },
            { label: "Registros favoráveis",            value: favoraveis,      color: "bg-teal-600",   urgent: false },
            { label: "Publicados em Caderno",           value: publicadas,      color: "bg-gray-600",   urgent: false },
          ].map((card) => (
            <div key={card.label} className={`${card.color} rounded-xl p-4 text-white ${card.urgent ? "ring-2 ring-white ring-offset-2" : ""}`}>
              <p className="text-3xl font-bold">{card.value}</p>
              <p className="text-xs mt-1 opacity-90">{card.label}</p>
            </div>
          ))}
        </div>

        {pendentes.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
            <h2 className="text-base font-semibold text-gray-900 mb-3">Pendências — Ação necessária</h2>
            <div className="space-y-2">
              {pendentes.map((c) => (
                <Link key={c.id} href={`/comunicacoes/${c.id}`}
                  className="flex items-center justify-between px-4 py-3 rounded-lg border border-yellow-200 bg-yellow-50 hover:bg-yellow-100 transition-colors">
                  <div>
                    <p className="text-sm font-medium text-gray-900 font-mono">{c.protocolNumber}</p>
                    <p className="text-xs text-gray-500">{c.type.name}</p>
                  </div>
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${c.status === "PRAZO_EXPIRADO" ? "bg-red-200 text-red-900" : "bg-orange-200 text-orange-900"}`}>
                    {c.status === "PRAZO_EXPIRADO" ? "Prazo de defesa vencido" : "Aguardando sua ciência/defesa"}
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

  // ── DASHBOARD GERAL ───────────────────────────────────────────────────────
  const sp = await searchParams;
  const cursoId = sp.cursoId ?? "";

  const schoolFilter = getSchoolFilter(session.role, session.escola);

  // Busca cursos disponíveis para este usuário (limitados pela escola)
  const cursosDisponiveis = await prisma.course.findMany({
    where: { active: true, ...(schoolFilter ? { school: schoolFilter } : {}) },
    orderBy: { name: "asc" },
    select: { id: true, name: true, school: true },
  });

  // IDs no escopo: curso selecionado OU todos os disponíveis
  const scopeCourseIds = cursoId
    ? [cursoId]
    : cursosDisponiveis.map((c) => c.id);

  const cursoSelecionado = cursosDisponiveis.find((c) => c.id === cursoId);
  const labelEscopo = schoolFilter === "ESFAP" ? "EsFAP"
    : schoolFilter === "ESFO"  ? "EsFO"
    : "Todos os cursos";

  const data = await getDashboardGeral(session.role, session.userId, scopeCourseIds);
  const canCreate = session.role !== "ALUNO";

  const cardsEmTramite = [
    { label: "CPIs Registradas",              value: data.cards.totalCPIs,                    color: "bg-blue-600" },
    { label: "Ag. Ciência/Defesa do Aluno",   value: data.cards.aguardandoCienciaDefesa,      color: "bg-yellow-500" },
    { label: "Prazo Vencido",                 value: data.cards.prazoVencido,                 color: "bg-red-600" },
    { label: "Aguardando Parecer",            value: data.cards.aguardandoParecer,            color: "bg-purple-600" },
    { label: "Aguardando Decisão",            value: data.cards.aguardandoDecisao,            color: "bg-indigo-600" },
    { label: "CPIs decididas ag. publicação", value: data.cards.cpisDecididasAgPublicacao,    color: "bg-green-600" },
    { label: "Ref. elogiosa/Elogio",          value: data.cards.referencias,                 color: "bg-teal-600" },
  ];

  const cardsTramitadas = [
    { label: "CPIs c/ sanção publicadas",                      value: data.cards.cpisPublicadas,      color: "bg-slate-700" },
    { label: "Ref. elogiosa/Elogio publicados",                value: data.cards.elogiososPublicados, color: "bg-emerald-700" },
    { label: "Cadernos publicados",                            value: data.cards.cadernosPublicados,  color: "bg-cyan-700" },
    { label: "CPIs arquivadas (sem desconto)",                 value: data.cards.cpisArquivadas,      color: "bg-slate-500" },
    { label: "Ref. elogiosa/Elogio arquivados (sem acréscimo)",value: data.cards.elogiososArquivados, color: "bg-emerald-500" },
  ];

  return (
    <div className="p-6">
      {/* Título */}
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-gray-900">Painel de Controle</h1>
        <p className="text-sm text-gray-500">
          {cursoSelecionado ? cursoSelecionado.name : labelEscopo}
        </p>
      </div>

      {/* ── Seletor de cursos ──────────────────────────────────────────────── */}
      {cursosDisponiveis.length > 1 && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Filtrar por curso</p>
          <div className="flex flex-wrap gap-2">
            {/* Opção "Todos" */}
            <Link
              href="/dashboard"
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                !cursoId
                  ? "bg-[#1e3a5f] text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              {schoolFilter === "ESFAP" ? "Todos da EsFAP"
                : schoolFilter === "ESFO" ? "Todos da EsFO"
                : "Todos os cursos"}
            </Link>

            {/* Um botão por curso disponível */}
            {cursosDisponiveis.map((curso) => (
              <Link
                key={curso.id}
                href={`/dashboard?cursoId=${curso.id}`}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  cursoId === curso.id
                    ? "bg-[#1e3a5f] text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                {curso.name}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Em trâmite */}
      <div className="mb-6">
        <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Em trâmite</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3">
          {cardsEmTramite.map((card) => (
            <div key={card.label} className={`${card.color} rounded-xl p-4 text-white`}>
              <p className="text-3xl font-bold">{card.value}</p>
              <p className="text-xs mt-1 opacity-90 leading-tight">{card.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Tramitadas */}
      <div className="mb-8">
        <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Tramitadas</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-5 gap-3">
          {cardsTramitadas.map((card) => (
            <div key={card.label} className={`${card.color} rounded-xl p-4 text-white`}>
              <p className="text-3xl font-bold">{card.value}</p>
              <p className="text-xs mt-1 opacity-90 leading-tight">{card.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Zona de risco */}
      {data.zonaRisco.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-5 mb-8">
          <h2 className="text-lg font-semibold text-red-800 mb-3">
            ⚠ Alunos em Zona de Risco (nota {"<"} 7,0)
            {cursoSelecionado && <span className="text-sm font-normal ml-2">— {cursoSelecionado.name}</span>}
          </h2>
          <div className="space-y-2">
            {data.zonaRisco.map((s) => {
              const faixa = faixaNota(s.nota);
              return (
                <Link key={s.id} href={`/alunos/${s.id}`}
                  className="flex items-center justify-between bg-white rounded-lg px-4 py-2 hover:bg-red-50 transition-colors">
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
              <Link href="/comunicacoes/nova/cpi" className="block w-full text-left px-4 py-2.5 bg-[#1e3a5f] text-white rounded-lg text-sm hover:bg-[#16304f] transition-colors">+ Nova CPI</Link>
              <Link href="/comunicacoes/nova/referencia" className="block w-full text-left px-4 py-2.5 border border-[#1e3a5f] text-[#1e3a5f] rounded-lg text-sm hover:bg-blue-50 transition-colors">+ Nova Referência Elogiosa</Link>
              <Link href="/comunicacoes/nova/elogio-bi" className="block w-full text-left px-4 py-2.5 border border-green-600 text-green-700 rounded-lg text-sm hover:bg-green-50 transition-colors">+ Elogio Publicado em BI <span className="text-xs font-normal opacity-70">(+1,0 pt)</span></Link>
              <Link href="/alunos/novo" className="block w-full text-left px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50 transition-colors">+ Cadastrar Aluno</Link>
            </div>
          </div>
        )}

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-base font-semibold text-gray-900 mb-3">Faixas de Nota — Conduta Profissional</h2>
          <div className="space-y-1.5 text-sm">
            {[
              { label: "≥ 9,0",      tailwind: "bg-green-800 text-white", desc: "Excelente" },
              { label: "8,0 – 8,9",  tailwind: "bg-green-500 text-white", desc: "Bom" },
              { label: "7,0 – 7,9",  tailwind: "bg-yellow-400 text-black", desc: "Regular" },
              { label: "6,0 – 6,9",  tailwind: "bg-red-400 text-white", desc: "Atenção" },
              { label: "< 6,0",      tailwind: "bg-red-700 text-white", desc: "Reprovado" },
            ].map((f) => (
              <div key={f.label} className="flex items-center gap-3">
                <span className={`text-xs px-2 py-0.5 rounded font-bold ${f.tailwind} w-20 text-center`}>{f.label}</span>
                <span className="text-gray-600">{f.desc}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
