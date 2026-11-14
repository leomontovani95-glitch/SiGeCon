import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { verifySession, ESFO_CFO_RANK } from "@/lib/dal";

// Aba "Nova Comunicação": ponto único para confeccionar qualquer comunicação.
// Mostra apenas os tipos que o usuário PODE registrar — a mesma regra das telas
// e das actions de registro:
//  - Staff (qualquer perfil que não seja aluno): CPI, Referência Elogiosa,
//    Elogio publicado em BI, TD/TAC e registro em lote.
//  - Aluno do CFO (EsFO): apenas CPI e Referência Elogiosa.
//  - Demais alunos: não registram comunicações.
type Opcao = { href: string; titulo: string; descricao: string; cor: string };

const OPCAO_CPI: Opcao = {
  href: "/comunicacoes/nova/cpi",
  titulo: "CPI",
  descricao: "Comunicação de Procedimento Irregular (CPI 1, 2 ou 3), com ciência e defesa do aluno.",
  cor: "border-l-[#1e3a5f]",
};
const OPCAO_REFERENCIA: Opcao = {
  href: "/comunicacoes/nova/referencia",
  titulo: "Referência Elogiosa",
  descricao: "Registro de conduta elogiável, sujeito a parecer e homologação.",
  cor: "border-l-blue-500",
};
const OPCOES_STAFF: Opcao[] = [
  OPCAO_CPI,
  OPCAO_REFERENCIA,
  {
    href: "/comunicacoes/nova/elogio-bi",
    titulo: "Elogio publicado em BI",
    descricao: "Transcrição de elogio já publicado em BGPM. Lançado direto no caderno.",
    cor: "border-l-green-600",
  },
  {
    href: "/comunicacoes/nova/transgressao",
    titulo: "TD / TAC",
    descricao: "Transgressão Disciplinar ou Termo de Ajuste de Conduta já publicado em BGPM.",
    cor: "border-l-orange-600",
  },
  {
    href: "/comunicacoes/nova/lote",
    titulo: "Registro em lote",
    descricao: "Mesma CPI ou Referência Elogiosa para vários alunos de uma vez (mesmo fato).",
    cor: "border-l-gray-400",
  },
];

export default async function NovaComunicacaoPage() {
  const session = await verifySession();

  let opcoes = OPCOES_STAFF;
  if (session.role === "ALUNO") {
    const student = await prisma.student.findFirst({
      where: { userId: session.userId },
      select: { course: { select: { name: true } } },
    });
    if (!student || !(student.course.name in ESFO_CFO_RANK)) redirect("/acesso-negado");
    opcoes = [OPCAO_CPI, OPCAO_REFERENCIA];
  }

  return (
    <div className="p-6 max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Nova Comunicação</h1>
        <p className="text-sm text-gray-500">Escolha o tipo de comunicação que deseja registrar.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {opcoes.map((o) => (
          <Link
            key={o.href}
            href={o.href}
            className={`block bg-white rounded-xl border border-gray-200 border-l-4 ${o.cor} p-5 hover:shadow-md hover:border-gray-300 transition focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]`}
          >
            <h2 className="text-base font-semibold text-gray-900">{o.titulo}</h2>
            <p className="text-sm text-gray-500 mt-1">{o.descricao}</p>
            <span className="inline-block mt-3 text-sm font-medium text-[#1e3a5f]">Registrar →</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
