import { verifyRole, manageableRoles, USER_MANAGERS } from "@/lib/dal";
import UsuarioForm from "../_components/UsuarioForm";

export default async function NovoUsuarioPage() {
  const session = await verifyRole(...USER_MANAGERS);
  const allowedRoles = manageableRoles(session.role);
  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Novo Usuário</h1>
      <UsuarioForm allowedRoles={allowedRoles} />
    </div>
  );
}
