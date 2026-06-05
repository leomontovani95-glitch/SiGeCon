import Link from "next/link";
export default function AcessoNegadoPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <p className="text-6xl font-bold text-red-600 mb-4">403</p>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Acesso Negado</h1>
        <p className="text-gray-500 mb-6">Você não tem permissão para acessar esta página.</p>
        <Link href="/dashboard" className="btn-primary inline-block">Voltar ao Painel</Link>
      </div>
    </div>
  );
}
