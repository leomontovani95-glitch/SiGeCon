"use server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { verifyRole, escolaNoEscopo, CADERNO_MANAGERS } from "@/lib/dal";

// Escopo de escola da AACP: deriva da escola do caderno vinculado.
async function aacpNoEscopo(session: { role: string; escola?: string | null }, disciplinaryBookId: string): Promise<boolean> {
  const book = await prisma.disciplinaryBook.findUnique({
    where: { id: disciplinaryBookId },
    select: { school: true, course: { select: { school: true } } },
  });
  if (!book) return false;
  return escolaNoEscopo(session, book.course?.school ?? book.school);
}

function getNextSaturday(): Date {
  const today = new Date();
  const day = today.getDay(); // 0=Dom..6=Sab
  const diff = day === 6 ? 7 : 6 - day;
  const sat = new Date(today);
  sat.setDate(today.getDate() + diff);
  sat.setHours(0, 0, 0, 0);
  return sat;
}

const DEFAULT_GROUPS = [
  {
    day: "SABADO", cpiLabel: "1, 2 e 3", order: 0,
    actions: [
      { acao: "Chamada, inspeção do efetivo e hasteamento da Bandeira Nacional.", periodo: "06h45min – 07h30min", order: 0 },
      { acao: "Intervalo e troca do fardamento para o uniforme de Defesa Pessoal (D-2).", periodo: "07h30min – 08h", order: 1 },
      { acao: "Manutenção e organização das salas de aulas, salas de apoio e áreas adjacentes, inclusive da sala de apoio próximo à quadra da APM/ES.", periodo: "08h – 11h", order: 2 },
      { acao: "Formatura no platô das bandeiras para a conferência e liberação para o almoço para os discentes de CPI 2 e 3 e liberação daqueles de CPI 1 pelo Oficial de Dia.", periodo: "11h20min – 12h", order: 3 },
      { acao: "Intervalo para o almoço.", periodo: "12h – 13h30min", order: 4 },
    ],
  },
  {
    day: "SABADO", cpiLabel: "2 e 3", order: 1,
    actions: [
      { acao: "Chamada para o efetivo de CPI 2 e 3 e conferência.", periodo: "13h30min – 14h", order: 0 },
      { acao: "Estudo autônomo.", periodo: "14h – 17h", order: 1 },
      { acao: "Formatura no platô das bandeiras para a conferência do efetivo, arriamento da Bandeira Nacional e procedimento de liberação pelo Oficial de Dia.", periodo: "17h20min – 18h", order: 2 },
    ],
  },
  {
    day: "DOMINGO", cpiLabel: "3", order: 2,
    actions: [
      { acao: "Chamada, inspeção do efetivo e hasteamento da Bandeira Nacional.", periodo: "06h45min – 07h30min", order: 0 },
      { acao: "Intervalo e troca do fardamento para o uniforme de Defesa Pessoal (D-2).", periodo: "07h30min – 08h", order: 1 },
      { acao: "Manutenção e organização dos alojamentos do CFSd. Apoio à SAM.", periodo: "08h – 11h", order: 2 },
      { acao: "Formatura no platô das bandeiras para a conferência e liberação pelo Oficial de Dia.", periodo: "11h20min – 12h", order: 3 },
    ],
  },
];

const DEFAULT_MATERIAIS = [
  "Materiais necessários para manutenção e limpeza das instalações físicas da APM",
  "Material didático referente às disciplinas cursadas durante a semana",
];

const DEFAULT_OBSERVACOES = [
  "O tempo previsto, bem como a hora de início de cada atividade pode ser modificado de acordo com a demanda do dia, ficando a critério do supervisor",
  "Os alunos de AACP estão proibidos de sair da APM em qualquer situação, inclusive durante o horário de almoço, salvo questões de urgência/emergência, com autorização do Oficial de Dia",
  "Intervalos extras para hidratação e alimentação poderão ser definidos pelo Oficial de Dia",
  "O Oficial de Dia poderá inverter a ordem das atividades bem como suprimi-las de acordo com a demanda e quantidade de alunos presentes no cumprimento da AACP",
  "Os alunos escalados no serviço interno de guarda ou em instrução nos mesmos dias de cumprimento de AACP deverão seguir a seguinte determinação: a) CPI 1 e Guarda/Instrução no sábado: cumprirá AACP no domingo, das 07h às 12h; b) CPI 2 e Guarda/Instrução no sábado: cumprirá AACP no domingo, das 07h às 18h; c) CPI 3 e Guarda/Instrução no sábado: cumprirá AACP no domingo, das 07h às 18h, e o restante da carga conforme memorando publicado pela Escola; d) CPI 3 e Guarda/Instrução no domingo: cumprirá AACP normalmente no sábado, das 07h às 18h, e o restante da carga horária conforme memorando publicado pela Escola",
];

const DEFAULT_DISPOSITIVOS = [
  "Manual do Aluno 2022",
  "Regulamento Interno e dos Serviços Gerais do Exército Brasileiro (RISG)",
];

export async function criarAACP(disciplinaryBookId: string) {
  const session = await verifyRole(...CADERNO_MANAGERS);
  if (!(await aacpNoEscopo(session, disciplinaryBookId))) return;

  const sat = getNextSaturday();
  const sun = new Date(sat);
  sun.setDate(sat.getDate() + 1);

  await prisma.aacp.create({
    data: {
      disciplinaryBookId,
      local: "Academia de Polícia Militar do Espírito Santo - APM/ES",
      saturdayDate: sat,
      sundayDate: sun,
      dayGroups: {
        create: DEFAULT_GROUPS.map(g => ({
          day: g.day,
          cpiLabel: g.cpiLabel,
          order: g.order,
          actions: { create: g.actions },
        })),
      },
      materiais: { create: DEFAULT_MATERIAIS.map((text, order) => ({ text, order })) },
      observacoes: { create: DEFAULT_OBSERVACOES.map((text, order) => ({ text, order })) },
      dispositivosLegais: { create: DEFAULT_DISPOSITIVOS.map((text, order) => ({ text, order })) },
    },
  });

  revalidatePath(`/caderno/${disciplinaryBookId}/editar`);
}

export type AACPSaveData = {
  local: string;
  fiscalizacao: string;
  saturdayDate: string;
  sundayDate: string;
  dayGroups: {
    day: string;
    cpiLabel: string;
    order: number;
    actions: { acao: string; periodo: string; order: number }[];
  }[];
  materiais: { text: string; order: number }[];
  observacoes: { text: string; order: number }[];
  dispositivosLegais: { text: string; order: number }[];
};

export async function removerAACP(aacpId: string) {
  const session = await verifyRole(...CADERNO_MANAGERS);
  const aacp = await prisma.aacp.findUnique({ where: { id: aacpId }, select: { disciplinaryBookId: true } });
  if (!aacp) return;
  if (!(await aacpNoEscopo(session, aacp.disciplinaryBookId))) return;
  await prisma.aacp.delete({ where: { id: aacpId } });
  revalidatePath(`/caderno/${aacp.disciplinaryBookId}/editar`);
}

export async function salvarAACP(aacpId: string, data: AACPSaveData) {
  const session = await verifyRole(...CADERNO_MANAGERS);

  const aacp = await prisma.aacp.findUnique({ where: { id: aacpId }, select: { disciplinaryBookId: true } });
  if (!aacp) return;
  if (!(await aacpNoEscopo(session, aacp.disciplinaryBookId))) return;

  await prisma.$transaction(async (tx) => {
    // Deleta sub-items (cascade cuida das actions)
    await tx.aacpDayGroup.deleteMany({ where: { aacpId } });
    await tx.aacpMaterial.deleteMany({ where: { aacpId } });
    await tx.aacpObservacao.deleteMany({ where: { aacpId } });
    await tx.aacpDispositivoLegal.deleteMany({ where: { aacpId } });

    await tx.aacp.update({
      where: { id: aacpId },
      data: {
        local: data.local,
        fiscalizacao: data.fiscalizacao,
        saturdayDate: new Date(data.saturdayDate + "T12:00:00"),
        sundayDate: new Date(data.sundayDate + "T12:00:00"),
        dayGroups: {
          create: data.dayGroups.map(g => ({
            day: g.day,
            cpiLabel: g.cpiLabel,
            order: g.order,
            actions: { create: g.actions },
          })),
        },
        materiais: { create: data.materiais },
        observacoes: { create: data.observacoes },
        dispositivosLegais: { create: data.dispositivosLegais },
      },
    });
  });

  revalidatePath(`/caderno/${aacp.disciplinaryBookId}/editar`);
}
