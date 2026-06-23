import { verifySession, getSchoolFilter, COMANDANTES, PARECERISTAS, VIEWERS_APM, ESFO_CFO_RANK } from "@/lib/dal";
import { prisma } from "@/lib/db";
import Sidebar from "@/components/Sidebar";
import Breadcrumb from "@/components/Breadcrumb";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await verifySession();
  const { role } = session;

  const userRank = await prisma.user
    .findUnique({ where: { id: session.userId }, select: { rank: true } })
    .then((u) => u?.rank ?? "");

  const school = getSchoolFilter(role, session.escola);
  const schoolFilter = school ? { course: { school } } : {};
  const badgeCounts: Record<string, number> = {};
  let canCreateComm = false;

  // ── /despachos badge ─────────────────────────────────────────────────────
  if ((PARECERISTAS as string[]).includes(role)) {
    const n = await prisma.communication.count({
      where: { status: { in: ["AGUARDANDO_PARECER", "JUSTIFICATIVA_APRESENTADA"] }, ...schoolFilter },
    });
    if (n > 0) badgeCounts["/despachos"] = n;
  } else if (role === "CHEFE_DIVISAO_ACADEMICA") {
    // O Chefe da Divisão Acadêmica só decide CPIs encaminhadas pela Escola.
    const n = await prisma.communication.count({
      where: { status: "AGUARDANDO_DECISAO_DIVISAO" },
    });
    if (n > 0) badgeCounts["/despachos"] = n;
  } else if (role === "ADMINISTRADOR") {
    const n = await prisma.communication.count({
      where: { status: { in: ["AGUARDANDO_DECISAO", "AGUARDANDO_DECISAO_DIVISAO"] }, ...schoolFilter },
    });
    if (n > 0) badgeCounts["/despachos"] = n;
  } else if ((COMANDANTES as string[]).includes(role)) {
    const n = await prisma.communication.count({
      where: { status: "AGUARDANDO_DECISAO", ...schoolFilter },
    });
    if (n > 0) badgeCounts["/despachos"] = n;
  } else if ((VIEWERS_APM as string[]).includes(role)) {
    const n = await prisma.communication.count({
      where: { status: { in: ["AGUARDANDO_PARECER", "JUSTIFICATIVA_APRESENTADA", "AGUARDANDO_DECISAO", "AGUARDANDO_DECISAO_DIVISAO"] } },
    });
    if (n > 0) badgeCounts["/despachos"] = n;
  }

  // ── /comunicacoes badge ──────────────────────────────────────────────────
  if (role === "PROTOCOLO") {
    // Comunicações recém-registradas aguardando trâmite
    const n = await prisma.communication.count({
      where: { status: "REGISTRADA", ...schoolFilter },
    });
    if (n > 0) badgeCounts["/comunicacoes"] = n;
  } else if (role === "ALUNO") {
    // Comunicações do aluno aguardando sua ação + verificar se pode criar comunicação
    const student = await prisma.student.findFirst({
      where: { userId: session.userId },
      select: { id: true, course: { select: { name: true } } },
    });
    if (student) {
      const n = await prisma.communication.count({
        where: {
          studentId: student.id,
          status: { in: ["AGUARDANDO_CIENCIA", "AGUARDANDO_DEFESA", "PRAZO_EXPIRADO"] },
        },
      });
      if (n > 0) badgeCounts["/comunicacoes"] = n;
      canCreateComm = student.course.name in ESFO_CFO_RANK;
    }
  }

  return (
    <div className="flex min-h-screen print:block">
      <Sidebar role={role} additionalRoles={session.additionalRoles} rank={userRank} warName={session.warName} badgeCounts={badgeCounts} canCreateComm={canCreateComm} />
      {/* pt-14 reserva o espaço da barra superior fixa no celular; no desktop
          (md+) e na impressão não há barra superior, então pt-0. */}
      <main className="flex-1 overflow-auto bg-gray-50 pt-14 md:pt-0 print:overflow-visible print:w-full print:pt-0">
        <Breadcrumb />
        {children}
      </main>
    </div>
  );
}
