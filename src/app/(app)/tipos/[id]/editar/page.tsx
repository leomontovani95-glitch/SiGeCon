import { prisma } from "@/lib/db";
import { verifyRole } from "@/lib/dal";
import { notFound } from "next/navigation";
import TipoForm from "../../_components/TipoForm";
export default async function EditarTipoPage({ params }: { params: Promise<{ id: string }> }) {
  await verifyRole("ADMINISTRADOR", "COMANDANTE_ESFAP", "COMANDANTE_ESFO", "CHEFE_DIVISAO_ACADEMICA", "SUBCOMANDANTE_ESFAP", "SUBCOMANDANTE_ESFO", "OFICIAL_ESFAP", "OFICIAL_ESFO");
  const { id } = await params;
  const tipo = await prisma.communicationType.findUnique({ where: { id } });
  if (!tipo) notFound();
  return <div className="p-6 max-w-xl"><h1 className="text-2xl font-bold text-gray-900 mb-6">Editar Tipo</h1><TipoForm id={tipo.id} defaultValues={{ name: tipo.name, description: tipo.description ?? "", score: String(tipo.score), scoreNature: tipo.scoreNature, active: String(tipo.active) }} /></div>;
}
