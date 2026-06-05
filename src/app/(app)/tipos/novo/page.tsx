import { verifyRole } from "@/lib/dal";
import TipoForm from "../_components/TipoForm";
export default async function NovoTipoPage() {
  await verifyRole("ADMINISTRADOR", "COMANDANTE_ESFAP", "COMANDANTE_ESFO", "CHEFE_DIVISAO_ACADEMICA", "SUBCOMANDANTE_ESFAP", "SUBCOMANDANTE_ESFO", "OFICIAL_ESFAP", "OFICIAL_ESFO");
  return <div className="p-6 max-w-xl"><h1 className="text-2xl font-bold text-gray-900 mb-6">Novo Tipo de Comunicação</h1><TipoForm /></div>;
}
