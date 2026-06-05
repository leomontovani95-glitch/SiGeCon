import { verifySession, getSchoolFilter, COMANDANTES, PARECERISTAS, VIEWERS_APM } from "@/lib/dal";
import { prisma } from "@/lib/db";
import Sidebar from "@/components/Sidebar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await verifySession();
  const { role } = session;

  const userRank = await prisma.user
    .findUnique({ where: { id: session.userId }, select: { rank: true } })
    .then((u) => u?.rank ?? "");

  let pendingDespachos = 0;
  const school = getSchoolFilter(role, session.escola);
  const schoolFilter = school ? { course: { school } } : {};

  if ((PARECERISTAS as string[]).includes(role)) {
    pendingDespachos = await prisma.communication.count({
      where: { status: { in: ["AGUARDANDO_PARECER", "JUSTIFICATIVA_APRESENTADA"] }, ...schoolFilter },
    });
  } else if ((COMANDANTES as string[]).includes(role)) {
    pendingDespachos = await prisma.communication.count({
      where: { status: "AGUARDANDO_DECISAO", ...schoolFilter },
    });
  } else if ((VIEWERS_APM as string[]).includes(role)) {
    pendingDespachos = await prisma.communication.count({
      where: { status: { in: ["AGUARDANDO_PARECER", "JUSTIFICATIVA_APRESENTADA", "AGUARDANDO_DECISAO"] } },
    });
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar role={role} rank={userRank} warName={session.warName} pendingDespachos={pendingDespachos} />
      <main className="flex-1 overflow-auto bg-gray-50">
        {children}
      </main>
    </div>
  );
}
