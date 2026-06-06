import { verifyRole } from "@/lib/dal";
import UsuarioForm from "../_components/UsuarioForm";

export default async function NovoUsuarioPage() {
  await verifyRole(
    "ADMINISTRADOR", "COMANDANTE_ESFAP", "COMANDANTE_ESFO",
    "SUBCOMANDANTE_ESFAP", "SUBCOMANDANTE_ESFO", "OFICIAL_ESFAP", "OFICIAL_ESFO",
  );
  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Novo Usuário</h1>
      <UsuarioForm />
    </div>
  );
}
