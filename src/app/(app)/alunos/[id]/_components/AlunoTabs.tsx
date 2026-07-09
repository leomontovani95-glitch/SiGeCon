import Link from "next/link";

// Abas do perfil do aluno. A aba "Observações" só aparece para quem tem acesso
// (staff de Oficial de escola p/ cima); alunos e perfis sem acesso nem a veem.
export default function AlunoTabs({
  studentId,
  active,
  showObservacoes,
}: {
  studentId: string;
  active: "perfil" | "observacoes";
  showObservacoes: boolean;
}) {
  const tabs: { key: "perfil" | "observacoes"; label: string; href: string }[] = [
    { key: "perfil", label: "Perfil e Histórico", href: `/alunos/${studentId}` },
  ];
  if (showObservacoes) {
    tabs.push({ key: "observacoes", label: "Observações", href: `/alunos/${studentId}/observacoes` });
  }

  return (
    <div className="flex gap-1 border-b border-gray-200 mb-6">
      {tabs.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
            active === t.key
              ? "border-[#1e3a5f] text-[#1e3a5f]"
              : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
          }`}
        >
          {t.label}
        </Link>
      ))}
    </div>
  );
}
