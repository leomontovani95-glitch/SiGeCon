import Link from "next/link";
export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <p className="text-6xl font-bold text-gray-300 mb-4">404</p>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Página não encontrada</h1>
        <p className="text-gray-500 mb-6">A página que você procura não existe.</p>
        <Link href="/dashboard" className="btn-primary inline-block">Voltar ao Painel</Link>
      </div>
    </div>
  );
}
