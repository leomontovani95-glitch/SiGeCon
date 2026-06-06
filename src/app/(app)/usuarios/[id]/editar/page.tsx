import { prisma } from "@/lib/db";
import { verifyRole } from "@/lib/dal";
import { notFound } from "next/navigation";
import UsuarioForm from "../../_components/UsuarioForm";
import ResetarSenhaBtn from "../../_components/ResetarSenhaBtn";

const PODE_RESETAR = ["ADMINISTRADOR", "CHEFE_DIVISAO_ACADEMICA", "COMANDANTE_ESFAP", "COMANDANTE_ESFO"];

export default async function EditarUsuarioPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await verifyRole("ADMINISTRADOR", "COMANDANTE_ESFAP", "COMANDANTE_ESFO");
  const { id } = await params;
  const usuario = await prisma.user.findUnique({ where: { id } });
  if (!usuario) notFound();

  const podeResetar = PODE_RESETAR.includes(session.role);

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Editar Usuário</h1>
      <UsuarioForm
        id={usuario.id}
        defaultValues={{
          fullName: usuario.fullName,
          warName: usuario.warName,
          rank: usuario.rank,
          rg: usuario.rg,
          cpf: usuario.cpf ?? "",
          escola: usuario.escola ?? "TODAS",
          functionalNumber: usuario.functionalNumber,
          email: usuario.email ?? "",
          role: usuario.role,
          active: String(usuario.active),
        }}
        additionalRolesDefault={(usuario.additionalRoles ?? "").split(",").filter(Boolean)}
      />
      {podeResetar && <ResetarSenhaBtn userId={usuario.id} />}
    </div>
  );
}
