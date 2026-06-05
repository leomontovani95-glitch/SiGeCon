import { verifyRole } from "@/lib/dal";
import RegraForm from "../_components/RegraForm";
export default async function NovaRegraPage() {
  await verifyRole("ADMINISTRADOR");
  return <div className="p-6 max-w-2xl"><h1 className="text-2xl font-bold text-gray-900 mb-6">Novo Dispositivo do Manual</h1><RegraForm /></div>;
}
