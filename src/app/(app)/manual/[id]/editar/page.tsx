import { prisma } from "@/lib/db";
import { verifyRole, MANUAL_ROLES } from "@/lib/dal";
import { notFound } from "next/navigation";
import RegraForm from "../../_components/RegraForm";
export default async function EditarRegraPage({ params }: { params: Promise<{ id: string }> }) {
  await verifyRole(...MANUAL_ROLES);
  const { id } = await params;
  const regra = await prisma.manualRule.findUnique({ where: { id } });
  if (!regra) notFound();
  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Editar Dispositivo</h1>
      <RegraForm id={regra.id} defaultValues={{ article: regra.article, item: regra.item ?? "", letter: regra.letter ?? "", description: regra.description, theme: regra.theme ?? "", defaultCommunicationType: regra.defaultCommunicationType ?? "", defaultScore: regra.defaultScore != null ? String(regra.defaultScore) : "", halfCpi1: String(regra.halfCpi1), active: String(regra.active) }} />
    </div>
  );
}
