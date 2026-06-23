import { prisma } from "@/lib/db";
import { verifyRole, canManageUserScoped, manageableRoles, USER_MANAGERS, assignableSchools } from "@/lib/dal";
import { notFound, redirect } from "next/navigation";
import UsuarioForm from "../../_components/UsuarioForm";
import ResetarSenhaBtn from "../../_components/ResetarSenhaBtn";

export default async function EditarUsuarioPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await verifyRole(...USER_MANAGERS);
  const { id } = await params;
  const usuario = await prisma.user.findUnique({ where: { id } });
  if (!usuario) notFound();

  // Bloqueia edição de usuário de outra escola (exceto Comandante de Escola ↑).
  if (!canManageUserScoped(session, usuario)) redirect("/acesso-negado");

  const allowedRoles = manageableRoles(session.role);
  const allowedSchools = assignableSchools(session.role, session.escola);
  const podeResetar = canManageUserScoped(session, usuario);

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Editar Usuário</h1>
      <UsuarioForm
        id={usuario.id}
        allowedRoles={allowedRoles}
        allowedSchools={allowedSchools}
        defaultValues={{
          fullName: usuario.fullName,
          warName: usuario.warName,
          rank: usuario.rank,
          rg: usuario.rg,
          escola: usuario.escola ?? "TODAS",
          functionalNumber: usuario.functionalNumber,
          role: usuario.role,
          active: String(usuario.active),
        }}
        additionalRolesDefault={(usuario.additionalRoles ?? "").split(",").filter(Boolean)}
      />
      {podeResetar && <ResetarSenhaBtn userId={usuario.id} />}
    </div>
  );
}
