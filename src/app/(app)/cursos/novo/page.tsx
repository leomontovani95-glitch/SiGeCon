import { verifyRole } from "@/lib/dal";
import CursoForm from "../_components/CursoForm";

export default async function NovoCursoPage() {
  await verifyRole("ADMINISTRADOR", "PROTOCOLO", "COMANDANTE_ESFAP", "COMANDANTE_ESFO");
  return (
    <div className="p-6 max-w-xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Novo Curso</h1>
      <CursoForm />
    </div>
  );
}
