const { createClient } = require("@libsql/client");
const c = createClient({ url: "file:dev.db" });

const IDS = {
  montovani: "cmpyl4bg40000qguvxphg62ar",
  subEsfap:  "cmpzj8zql0003k0uv5kjn7tp1",
  cmdEsfap:  "cmpzj8zpm0000k0uvu6ejujgd",
  cfsd2025:  "cmpzxkmzx0002ekuvgxsaugug",
  cfo1:      "cmpyl4bj60008qguv9wb57v6p",
  cfsdP1:    "cmpzxkn080003ekuvg8aqtc79",
  cfsdP2:    "cmpzxkn0j0004ekuvwn8flirh",
  cfoP1:     "cmpyl4wqs0000zwuv9x97y4h0",
  cfoP2:     "cmpyl4wr90001zwuvpzev793k",
  cpi0: "cmpyl4bgo0001qguvk65mvhhh",
  cpi1: "cmpyl4bgy0002qguvvyk67bfh",
  cpi2: "cmpyl4bh80003qguvarwewyyl",
  cpi3: "cmpyl4bhj0004qguv237ce1v5",
  re:   "cmpyl4bhu0005qguvw5sb376l",
  ebi:  "cmpyl4bi70006qguv5ekssni8",
};

const cfsd = [
  { id:"cmq10epfu0003zwuvdumgozms", war:"ARINA",         nr:"2",  p:IDS.cfsdP1 },
  { id:"cmq10ephy0005zwuvnvjjrd3o", war:"ÁTTILA",        nr:"3",  p:IDS.cfsdP1 },
  { id:"cmq10epjx0007zwuvclny4xym", war:"BRUNNO",        nr:"4",  p:IDS.cfsdP1 },
  { id:"cmq10epnc0009zwuv4i3qokj0", war:"CAROLINY",      nr:"5",  p:IDS.cfsdP1 },
  { id:"cmq10epqq000bzwuv1bsyt14h", war:"GARIOLI",       nr:"6",  p:IDS.cfsdP1 },
  { id:"cmq10epu4000dzwuv2zarozmu", war:"DANRLEI",       nr:"7",  p:IDS.cfsdP1 },
  { id:"cmq10epxm000fzwuvdzb6r8g4", war:"DAYANE",        nr:"8",  p:IDS.cfsdP1 },
  { id:"cmq10eq11000hzwuvc39yaue4", war:"DEIVID",        nr:"9",  p:IDS.cfsdP1 },
  { id:"cmq10eq7p000lzwuvbiy9e0z3", war:"SPADETO",       nr:"12", p:IDS.cfsdP1 },
  { id:"cmq10eqb3000nzwuv5juyzr4a", war:"MARÇAL",        nr:"13", p:IDS.cfsdP1 },
  { id:"cmq10eqeh000pzwuvrexlayuy", war:"GABRIEL",       nr:"14", p:IDS.cfsdP1 },
  { id:"cmq10er2d0013zwuv6wmbzdrz", war:"LAZARO",        nr:"22", p:IDS.cfsdP1 },
  { id:"cmq10er610015zwuvh0tx9ey0", war:"FERNANDES",     nr:"23", p:IDS.cfsdP1 },
  { id:"cmq10er9h0017zwuvcx84azyf", war:"CERQUEIRA",     nr:"24", p:IDS.cfsdP1 },
  { id:"cmq10erd00019zwuvwigsypnh", war:"MARIANO",       nr:"25", p:IDS.cfsdP1 },
  { id:"cmq10erge001bzwuv6n2oup77", war:"BATISTA",       nr:"26", p:IDS.cfsdP1 },
  { id:"cmq10erjt001dzwuv550uffsn", war:"MARIANA",       nr:"27", p:IDS.cfsdP1 },
  { id:"cmq10ern7001fzwuvvrtk889w", war:"MATHEUS",       nr:"28", p:IDS.cfsdP1 },
  { id:"cmq10erqi001hzwuv6eef4mfr", war:"MIRELLA",       nr:"29", p:IDS.cfsdP1 },
  { id:"cmq10ertv001jzwuv899802jp", war:"PÂMELA BORGES", nr:"31", p:IDS.cfsdP1 },
  { id:"cmq10erxb001lzwuv0f0g8rh4", war:"RAFAEL",        nr:"32", p:IDS.cfsdP1 },
  { id:"cmq10es0p001nzwuvarmj2tli", war:"RYAN",          nr:"34", p:IDS.cfsdP1 },
  { id:"cmq10es41001pzwuveqfkql63", war:"SAMUEL",        nr:"35", p:IDS.cfsdP1 },
  { id:"cmq10es7g001rzwuvgmtakf48", war:"XAVIER",        nr:"36", p:IDS.cfsdP1 },
  { id:"cmq10esaw001tzwuvfltrpyke", war:"GERMANO",       nr:"37", p:IDS.cfsdP1 },
  { id:"cmq10eseh001vzwuvypjfzls3", war:"CALAZANS",      nr:"38", p:IDS.cfsdP1 },
  { id:"cmq10esit001xzwuvm498o074", war:"FLEGLER",       nr:"39", p:IDS.cfsdP2 },
  { id:"cmq10esm6001zzwuvdczr7cph", war:"COIMBRA",       nr:"40", p:IDS.cfsdP2 },
];

const cfo = [
  { id:"cmpyl4wrk0002zwuv54j3sf10", war:"ALMEIDA",  nr:"001", p:IDS.cfoP1 },
  { id:"cmpyl4wrv0003zwuv18x1u3qs", war:"SILVA",    nr:"002", p:IDS.cfoP1 },
  { id:"cmpyl4ws50004zwuvhpo5gwnn", war:"COSTA",    nr:"003", p:IDS.cfoP2 },
  { id:"cmpyl4wsf0005zwuvg7c4hylu", war:"SOUZA",    nr:"004", p:IDS.cfoP2 },
  { id:"cmpym9a9500026wuvuf360hdp", war:"LEONARDO", nr:"010", p:IDS.cfoP1 },
];

const R = {
  r142ia:  { id:"rule-142-i-a",   art:"142", inc:"I",   let:"a" },
  r142ib:  { id:"rule-142-i-b",   art:"142", inc:"I",   let:"b" },
  r142iia: { id:"rule-142-ii-a",  art:"142", inc:"II",  let:"a" },
  r142iib: { id:"rule-142-ii-b",  art:"142", inc:"II",  let:"b" },
  r142iic: { id:"rule-142-ii-c",  art:"142", inc:"II",  let:"c" },
  r142iid: { id:"rule-142-ii-d",  art:"142", inc:"II",  let:"d" },
  r142iie: { id:"rule-142-ii-e",  art:"142", inc:"II",  let:"e" },
  r142iiia:{ id:"rule-142-iii-a", art:"142", inc:"III", let:"a" },
  r142iiib:{ id:"rule-142-iii-b", art:"142", inc:"III", let:"b" },
  r142iiic:{ id:"rule-142-iii-c", art:"142", inc:"III", let:"c" },
  r143ia:  { id:"rule-143-i-a",   art:"143", inc:"I",   let:"a" },
  r143iia: { id:"rule-143-ii-a",  art:"143", inc:"II",  let:"a" },
  r143iiia:{ id:"rule-143-iii-a", art:"143", inc:"III", let:"a" },
  r146ia:  { id:"manual-146-i",   art:"146", inc:"I",   let:"a" },
  r170iii: { id:"rule-170-iii",   art:"170", inc:"III", let:null },
};

const now = new Date("2026-06-06T10:00:00.000Z");
const dA = (n) => new Date(now.getTime() - n*86400000).toISOString();
const dF = (n) => new Date(now.getTime() + n*86400000).toISOString();

async function ins(sql, args=[]) { await c.execute({ sql, args }); }

async function cc({ id, proto, typeId, rule, student, courseId, factDate, desc, communicant, status, finalScore=null, prazo=null, defense=null, opinion=null, decision=null }) {
  await ins(`INSERT OR IGNORE INTO Communication
    (id,protocolNumber,typeId,studentId,courseId,courseNumber,platoonId,reporterId,
     factDate,factDescription,manualRuleId,article,item,letter,
     suggestedScore,communicantName,status,defenseDeadline,finalScore,createdAt,updatedAt)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [id,proto,typeId,student.id,courseId,student.nr,student.p,IDS.montovani,
     factDate,desc,rule.id,rule.art,rule.inc,rule.let,
     0.2,communicant,status,prazo,finalScore,factDate,now.toISOString()]);

  if (defense) {
    await ins(`INSERT OR IGNORE INTO StudentAcknowledgement (id,communicationId,studentId,acknowledgedAt,method) VALUES (?,?,?,?,?)`,
      [`ack-${id}`,id,student.id,dA(defense.daysAgo||1),defense.semDefesa?"SEM_DEFESA":"SISTEMA"]);
    if (!defense.semDefesa)
      await ins(`INSERT OR IGNORE INTO Defense (id,communicationId,studentId,text,submittedAt,isLate) VALUES (?,?,?,?,?,?)`,
        [`def-${id}`,id,student.id,defense.text,dA(defense.daysAgo||1),0]);
  }

  if (opinion)
    await ins(`INSERT OR IGNORE INTO Opinion (id,communicationId,authorId,authorRole,text,recommendation,createdAt) VALUES (?,?,?,?,?,?,?)`,
      [`op-${id}`,id,IDS.subEsfap,"SUBCOMANDANTE_ESFAP",opinion.text,opinion.rec,dA(opinion.daysAgo||0)]);

  if (decision)
    await ins(`INSERT OR IGNORE INTO Decision (id,communicationId,authorityId,decisionType,text,finalScore,decidedAt) VALUES (?,?,?,?,?,?,?)`,
      [`dec-${id}`,id,IDS.cmdEsfap,decision.type,decision.text,decision.score,dA(decision.daysAgo||0)]);
}

const OP_PUN = { daysAgo:2, rec:"Sugiro punição",
  text:"Após análise dos autos e da defesa, a infração está comprovada e as justificativas não afastam a responsabilidade. Manifesto-me pelo sancionamento disciplinar." };
const OP_ARQ = { daysAgo:2, rec:"Sugiro arquivamento",
  text:"As justificativas apresentadas são plausíveis e os elementos dos autos não sustentam punição. Manifesto-me pelo arquivamento." };
const DEC_SAN = { daysAgo:1, type:"Confirmar a sanção", score:0.2,
  text:"Após análise dos autos e do parecer, confirmo a sanção disciplinar com dedução de 0,2 pt na nota de conduta." };
const DEC_SAN3 = { daysAgo:1, type:"Confirmar a sanção", score:0.3,
  text:"Considerando a gravidade da conduta e o parecer, confirmo a CPI 3 com dedução de 0,3 pt na nota de conduta." };
const DEC_ARQ = { daysAgo:1, type:"Arquivar comunicação", score:null,
  text:"As justificativas são procedentes e não há elementos suficientes para punição. Determino o arquivamento, sem prejuízo ao aluno." };

async function main() {
  // ── CFSd 2025 AGUARDANDO CIÊNCIA (7) ────────────────────────────────────
  await cc({ id:"t001", proto:"CPI - 2026 - 0007 - CFSd 2025",
    typeId:IDS.cpi1, rule:R.r142ib, student:cfsd[0], courseId:IDS.cfsd2025,
    factDate:dA(3), communicant:"Ten RODRIGUES", status:"AGUARDANDO_CIENCIA", prazo:dF(1),
    desc:"A sd ARINA foi comunicada por faltar com urbanidade ao responder de forma desrespeitosa ao instrutor durante atividade física matinal, utilizando tom inadequado na presença de outros alunos." });

  await cc({ id:"t002", proto:"CPI - 2026 - 0008 - CFSd 2025",
    typeId:IDS.cpi2, rule:R.r142iia, student:cfsd[1], courseId:IDS.cfsd2025,
    factDate:dA(2), communicant:"Cb FERREIRA", status:"AGUARDANDO_CIENCIA", prazo:dF(2),
    desc:"O sd ÁTTILA foi verificado utilizando linguagem imprópria e gestos obscenos no interior do alojamento, na presença de vários colegas, contrariando as normas de conduta estabelecidas no regulamento." });

  await cc({ id:"t003", proto:"CPI - 2026 - 0009 - CFSd 2025",
    typeId:IDS.cpi3, rule:R.r142iiia, student:cfsd[2], courseId:IDS.cfsd2025,
    factDate:dA(4), communicant:"Sgt OLIVEIRA", status:"AGUARDANDO_CIENCIA", prazo:dF(0),
    desc:"O sd BRUNNO foi comunicado por desrespeitar e discutir com colega de curso no refeitório, com elevação de voz e gestos ameaçadores, perturbando o ambiente e desrespeitando os princípios de camaradagem." });

  await cc({ id:"t004", proto:"CPI - 2026 - 0010 - CFSd 2025",
    typeId:IDS.cpi1, rule:R.r142ia, student:cfsd[3], courseId:IDS.cfsd2025,
    factDate:dA(1), communicant:"Ten MENDES", status:"AGUARDANDO_CIENCIA", prazo:dF(3),
    desc:"A sd CAROLINY foi comunicada por desrespeitar as normas de boas maneiras ao não cumprimentar superiores durante formatura matinal, atitude verificada em duas ocasiões distintas no mesmo dia." });

  await cc({ id:"t005", proto:"CPI - 2026 - 0011 - CFSd 2025",
    typeId:IDS.cpi0, rule:R.r146ia, student:cfsd[4], courseId:IDS.cfsd2025,
    factDate:dA(2), communicant:"1º Sgt CARVALHO", status:"AGUARDANDO_CIENCIA", prazo:dF(2),
    desc:"O sd GARIOLI foi verificado durante inspeção com fardamento em visível desalinho: coturno sem graxa, uniforme amassado e distintivos fora do local regulamentar." });

  await cc({ id:"t006", proto:"CPI - 2026 - 0012 - CFSd 2025",
    typeId:IDS.cpi2, rule:R.r142iid, student:cfsd[5], courseId:IDS.cfsd2025,
    factDate:dA(3), communicant:"Maj SANTOS", status:"AGUARDANDO_CIENCIA", prazo:dF(1),
    desc:"O sd DANRLEI foi comunicado por utilizar-se do anonimato para enviar mensagem ofensiva ao grupo de comunicações do pelotão, gerando conflito e insatisfação entre os demais alunos." });

  await cc({ id:"t007", proto:"CPI - 2026 - 0013 - CFSd 2025",
    typeId:IDS.cpi1, rule:R.r143ia, student:cfsd[6], courseId:IDS.cfsd2025,
    factDate:dA(5), communicant:"Cap ALVES", status:"AGUARDANDO_CIENCIA", prazo:dA(1),
    desc:"A sd DAYANE ausentou-se da instrução de armamento sem autorização, sendo encontrada no alojamento durante atividade obrigatória. Ao ser questionada, apresentou justificativa inconsistente." });

  // ── CFSd 2025 AGUARDANDO PARECER (6) ────────────────────────────────────
  await cc({ id:"t008", proto:"CPI - 2026 - 0014 - CFSd 2025",
    typeId:IDS.cpi1, rule:R.r142ib, student:cfsd[7], courseId:IDS.cfsd2025,
    factDate:dA(8), communicant:"Ten RODRIGUES", status:"AGUARDANDO_PARECER", prazo:dA(3),
    defense:{ daysAgo:5, text:"Reconheço ter utilizado tom inadequado, porém estava sob grande pressão naquela ocasião. Comprometo-me a não repetir tal comportamento." },
    desc:"O sd DEIVID foi comunicado por faltar com urbanidade ao se recusar a auxiliar colega durante exercício tático, proferindo palavras desrespeitosas na frente do pelotão." });

  await cc({ id:"t009", proto:"CPI - 2026 - 0015 - CFSd 2025",
    typeId:IDS.cpi2, rule:R.r142iic, student:cfsd[8], courseId:IDS.cfsd2025,
    factDate:dA(7), communicant:"Sgt LIMA", status:"AGUARDANDO_PARECER", prazo:dA(2),
    defense:{ daysAgo:4, text:"Reconheço que estava conversando em voz alta após o recolher. Não sabia que perturbava o descanso dos colegas. Peço desculpas e me comprometo a observar o silêncio regulamentar." },
    desc:"O sd SPADETO perturbou o sossego no corredor do alojamento após o recolher, cantando e conversando em voz alta por cerca de 20 minutos, sendo alertado duas vezes antes da comunicação ser lavrada." });

  await cc({ id:"t010", proto:"CPI - 2026 - 0016 - CFSd 2025",
    typeId:IDS.cpi3, rule:R.r142iiib, student:cfsd[9], courseId:IDS.cfsd2025,
    factDate:dA(9), communicant:"Cap BARBOSA", status:"AGUARDANDO_PARECER", prazo:dA(4),
    defense:{ daysAgo:6, text:"Fui provocado repetidamente pelo colega antes do incidente. Não justifica minha atitude, mas solicito que o contexto seja considerado." },
    desc:"O sd MARÇAL teceu comentários inoportunos e depreciativos sobre a capacidade do colega de curso em frente a outros alunos e ao instrutor, criando ambiente de constrangimento." });

  await cc({ id:"t011", proto:"CPI - 2026 - 0017 - CFSd 2025",
    typeId:IDS.cpi1, rule:R.r142ia, student:cfsd[10], courseId:IDS.cfsd2025,
    factDate:dA(6), communicant:"Ten MENDES", status:"AGUARDANDO_PARECER", prazo:dA(1),
    defense:{ daysAgo:3, semDefesa:true },
    desc:"O sd GABRIEL foi comunicado por desrespeitar as normas de boas maneiras ao se apresentar sem cumprimentar na chegada ao quartel, hábito verificado repetidamente pelo instrutor responsável." });

  await cc({ id:"t012", proto:"RE - 2026 - 0005 - CFSd 2025",
    typeId:IDS.re, rule:R.r170iii, student:cfsd[11], courseId:IDS.cfsd2025,
    factDate:dA(7), communicant:"Maj PIMENTEL", status:"AGUARDANDO_PARECER", prazo:dA(2),
    defense:{ daysAgo:4, semDefesa:true },
    desc:"O sd LAZARO destacou-se ao identificar e comunicar à supervisão situação de colega com sinais de angústia psicológica antes de instrução de armamento, possibilitando assistência imediata." });

  await cc({ id:"t013", proto:"CPI - 2026 - 0018 - CFSd 2025",
    typeId:IDS.cpi2, rule:R.r142iie, student:cfsd[12], courseId:IDS.cfsd2025,
    factDate:dA(10), communicant:"1º Ten SOUSA", status:"AGUARDANDO_PARECER", prazo:dA(5),
    defense:{ daysAgo:7, text:"Estava animado após aprovação nas provas e acabei exagerando na comemoração. Peço desculpas ao instrutor e aos colegas presentes." },
    desc:"O sd FERNANDES portou-se de modo inconveniente no pátio de instrução, realizando gestos exagerados e brincadeiras inapropriadas durante descanso entre atividades." });

  // ── CFSd 2025 AGUARDANDO DECISÃO (5) ────────────────────────────────────
  await cc({ id:"t014", proto:"CPI - 2026 - 0019 - CFSd 2025",
    typeId:IDS.cpi1, rule:R.r142ib, student:cfsd[13], courseId:IDS.cfsd2025,
    factDate:dA(14), communicant:"Sgt COELHO", status:"AGUARDANDO_DECISAO", prazo:dA(9),
    defense:{ daysAgo:10, text:"Reconheço o ocorrido mas afirmo que estava exausto após semana de instrução intensa. A situação foi pontual e não reflete meu comportamento habitual." },
    opinion:OP_PUN,
    desc:"O sd CERQUEIRA respondeu de forma brusca ao colega que lhe pediu auxílio durante instrução de primeiros socorros, criando clima de hostilidade no grupo." });

  await cc({ id:"t015", proto:"CPI - 2026 - 0020 - CFSd 2025",
    typeId:IDS.cpi3, rule:R.r142iiic, student:cfsd[14], courseId:IDS.cfsd2025,
    factDate:dA(16), communicant:"Cap FERREIRA", status:"AGUARDANDO_DECISAO", prazo:dA(11),
    defense:{ daysAgo:12, text:"Não reconheço a gravidade atribuída. Apenas comentei sobre o rendimento do colega em tom de brincadeira. Não havia intenção de prejudicá-lo." },
    opinion:OP_PUN,
    desc:"O sd MARIANO praticou assédio moral ao colega, fazendo comentários repetidos e sistemáticos sobre sua capacidade intelectual durante semanas, causando sofrimento psicológico documentado pelo serviço médico." });

  await cc({ id:"t016", proto:"CPI - 2026 - 0021 - CFSd 2025",
    typeId:IDS.cpi2, rule:R.r143iia, student:cfsd[15], courseId:IDS.cfsd2025,
    factDate:dA(12), communicant:"Maj RIBEIRO", status:"AGUARDANDO_DECISAO", prazo:dA(7),
    defense:{ daysAgo:9, text:"Nunca tive intenção de desobedecer. Não ouvi a ordem corretamente por causa do barulho. Assim que compreendi, cumpri imediatamente." },
    opinion:OP_ARQ,
    desc:"O sd BATISTA deixou de cumprir ordem de superior imediato durante exercício tático, sendo verificado que aguardava orientação de outro instrutor sem comunicar a situação à cadeia de comando." });

  await cc({ id:"t017", proto:"RE - 2026 - 0006 - CFSd 2025",
    typeId:IDS.re, rule:R.r170iii, student:cfsd[16], courseId:IDS.cfsd2025,
    factDate:dA(13), communicant:"Ten QUEIROZ", status:"AGUARDANDO_DECISAO", prazo:dA(8),
    defense:{ daysAgo:10, semDefesa:true },
    opinion:{ daysAgo:3, rec:"Sugiro homologação (Referência Elogiosa)",
      text:"Após análise, verifico que o comportamento da aluna é digno de reconhecimento formal. O ato demonstrou liderança e espírito de corpo. Manifesto-me pela homologação." },
    desc:"A sd MARIANA prestou assistência espontânea a colega que sofreu lesão durante treinamento físico, administrando primeiros socorros corretamente até a chegada do serviço médico." });

  await cc({ id:"t018", proto:"BI - 2026 - 0001 - CFSd 2025",
    typeId:IDS.ebi, rule:R.r170iii, student:cfsd[17], courseId:IDS.cfsd2025,
    factDate:dA(11), communicant:"Cel MONTOVANI", status:"AGUARDANDO_DECISAO", prazo:dA(6),
    defense:{ daysAgo:8, semDefesa:true },
    opinion:{ daysAgo:2, rec:"Sugiro homologação (Referência Elogiosa)",
      text:"Conduta exemplar que merece reconhecimento formal pelo Comandante. Recomendo a homologação do Elogio em BI." },
    desc:"O sd MATHEUS obteve a melhor nota geral no semestre entre todos os alunos do CFSd 2025, destacando-se em todas as disciplinas teóricas e práticas." });

  // ── CFSd 2025 DECIDIDA — SANÇÃO (5) ─────────────────────────────────────
  await cc({ id:"t019", proto:"CPI - 2026 - 0022 - CFSd 2025",
    typeId:IDS.cpi2, rule:R.r142iic, student:cfsd[18], courseId:IDS.cfsd2025,
    factDate:dA(20), communicant:"Sgt NEVES", status:"DECIDIDA", finalScore:0.2, prazo:dA(15),
    defense:{ daysAgo:16, text:"Peço desculpas. Reconheço que minha conduta foi inadequada e comprometo-me a não repetir." },
    opinion:OP_PUN, decision:DEC_SAN,
    desc:"A sd MIRELLA perturbou o sossego após o recolher por duas noites consecutivas, dificultando o descanso do pelotão antes de atividade tática de longa duração." });

  await cc({ id:"t020", proto:"CPI - 2026 - 0023 - CFSd 2025",
    typeId:IDS.cpi3, rule:R.r142iiia, student:cfsd[19], courseId:IDS.cfsd2025,
    factDate:dA(22), communicant:"Cap LEAL", status:"DECIDIDA", finalScore:0.3, prazo:dA(17),
    defense:{ daysAgo:18, text:"Não reconheço os fatos como descritos. A situação foi mal interpretada pelo instrutor. Solicito revisão." },
    opinion:OP_PUN, decision:DEC_SAN3,
    desc:"A sd PÂMELA BORGES agrediu verbalmente colega de curso no vestiário com palavras de baixo calão, gerando conflito que precisou de intervenção de instrutores. O comportamento foi testemunhado por quatro colegas." });

  await cc({ id:"t021", proto:"CPI - 2026 - 0024 - CFSd 2025",
    typeId:IDS.cpi1, rule:R.r143ia, student:cfsd[20], courseId:IDS.cfsd2025,
    factDate:dA(25), communicant:"Ten RODRIGUES", status:"DECIDIDA", finalScore:0.2, prazo:dA(20),
    defense:{ daysAgo:21, semDefesa:true },
    opinion:OP_PUN, decision:DEC_SAN,
    desc:"O sd RAFAEL ausentou-se sem autorização do aquartelamento durante o intervalo do almoço, retornando com atraso para atividade vespertina sem justificativa plausível." });

  await cc({ id:"t022", proto:"CPI - 2026 - 0025 - CFSd 2025",
    typeId:IDS.cpi1, rule:R.r142ib, student:cfsd[21], courseId:IDS.cfsd2025,
    factDate:dA(18), communicant:"Maj FONSECA", status:"DECIDIDA", finalScore:0.2, prazo:dA(13),
    defense:{ daysAgo:14, text:"Reconheço que poderia ter me comunicado de forma mais respeitosa. Não tinha intenção de desrespeitar o instrutor." },
    opinion:OP_PUN, decision:DEC_SAN,
    desc:"O sd RYAN interrompeu a fala do instrutor durante aula teórica de legislação, fazendo comentários sarcásticos em voz audível para os demais alunos presentes." });

  await cc({ id:"t023", proto:"CPI - 2026 - 0026 - CFSd 2025",
    typeId:IDS.cpi2, rule:R.r142iib, student:cfsd[22], courseId:IDS.cfsd2025,
    factDate:dA(28), communicant:"1º Sgt PEREIRA", status:"DECIDIDA", finalScore:0.2, prazo:dA(23),
    defense:{ daysAgo:24, text:"Sabia que o conteúdo era inadequado mas não achei que seria problema no alojamento. Entendo que errei." },
    opinion:OP_PUN, decision:DEC_SAN,
    desc:"O sd SAMUEL foi comunicado por possuir material impresso de conteúdo pornográfico no interior do alojamento, encontrado durante inspeção surpresa." });

  // ── CFSd 2025 DECIDIDA — ARQUIVADA (4) ──────────────────────────────────
  await cc({ id:"t024", proto:"CPI - 2026 - 0027 - CFSd 2025",
    typeId:IDS.cpi0, rule:R.r146ia, student:cfsd[23], courseId:IDS.cfsd2025,
    factDate:dA(21), communicant:"Cb SANTOS", status:"DECIDIDA", finalScore:null, prazo:dA(16),
    defense:{ daysAgo:17, text:"Na data da inspeção, havia retornado de atividade no campo e ainda não tivera tempo de arrumar o uniforme. O instrutor chefe estava ciente da situação." },
    opinion:OP_ARQ, decision:DEC_ARQ,
    desc:"O sd XAVIER foi comunicado por fardamento em desalinho durante inspeção após retorno de exercício tático de três dias, sendo que o período de recomposição regulamentar ainda não havia sido concedido." });

  await cc({ id:"t025", proto:"CPI - 2026 - 0028 - CFSd 2025",
    typeId:IDS.cpi1, rule:R.r142ia, student:cfsd[24], courseId:IDS.cfsd2025,
    factDate:dA(30), communicant:"Ten ALVES", status:"DECIDIDA", finalScore:null, prazo:dA(25),
    defense:{ daysAgo:26, text:"Estava sob medicação com efeito colateral que causou sonolência. Tenho atestado médico do período. A situação foi isolada e involuntária." },
    opinion:OP_ARQ, decision:DEC_ARQ,
    desc:"O sd GERMANO foi comunicado por demonstrar falta de atenção durante instrução, sendo encontrado em estado de sonolência aparente. Apresentou atestado médico comprovando tratamento na época." });

  await cc({ id:"t026", proto:"CPI - 2026 - 0029 - CFSd 2025",
    typeId:IDS.cpi1, rule:R.r143ia, student:cfsd[25], courseId:IDS.cfsd2025,
    factDate:dA(26), communicant:"Sgt MOURA", status:"DECIDIDA", finalScore:null, prazo:dA(21),
    defense:{ daysAgo:22, text:"Solicitei autorização ao instrutor auxiliar presente, que me disse que poderia me ausentar brevemente. A informação não chegou ao instrutor principal." },
    opinion:OP_ARQ, decision:DEC_ARQ,
    desc:"O sd CALAZANS ausentou-se brevemente de instrução apresentando posteriormente autorização verbal concedida por instrutor auxiliar que não comunicou ao responsável pela atividade." });

  await cc({ id:"t027", proto:"RE - 2026 - 0007 - CFSd 2025",
    typeId:IDS.re, rule:R.r170iii, student:cfsd[26], courseId:IDS.cfsd2025,
    factDate:dA(35), communicant:"Cap RIBEIRO", status:"DECIDIDA", finalScore:0.2, prazo:dA(30),
    defense:{ daysAgo:32, semDefesa:true },
    opinion:{ daysAgo:5, rec:"Sugiro homologação (Referência Elogiosa)", text:"Comportamento exemplar digno de reconhecimento. Recomendo a homologação." },
    decision:{ daysAgo:2, type:"Deferir referência elogiosa", score:0.2,
      text:"Defiro a Referência Elogiosa ao sd FLEGLER pelo comportamento destacado, com acréscimo de 0,2 pt na nota de conduta." },
    desc:"O sd FLEGLER representou a escola com distinção em competição estadual de tiro esportivo policial, obtendo 1º lugar individual e contribuindo para o 2º lugar por equipe." });

  // ── CFSd 2025 VARIADOS — Elogiosos (3) ──────────────────────────────────
  await cc({ id:"t028", proto:"RE - 2026 - 0008 - CFSd 2025",
    typeId:IDS.re, rule:R.r170iii, student:cfsd[27], courseId:IDS.cfsd2025,
    factDate:dA(5), communicant:"Maj CARDOSO", status:"AGUARDANDO_CIENCIA", prazo:dF(2),
    desc:"O sd COIMBRA elaborou voluntariamente material didático complementar sobre legislação policial compartilhado com o pelotão, contribuindo significativamente para a aprovação coletiva na prova bimestral." });

  await cc({ id:"t029", proto:"BI - 2026 - 0002 - CFSd 2025",
    typeId:IDS.ebi, rule:R.r170iii, student:cfsd[4], courseId:IDS.cfsd2025,
    factDate:dA(40), communicant:"Cel MONTOVANI", status:"DECIDIDA", finalScore:1.0, prazo:dA(35),
    defense:{ daysAgo:37, semDefesa:true },
    opinion:{ daysAgo:10, rec:"Sugiro homologação (Referência Elogiosa)", text:"Ato excepcional de bravura que merece reconhecimento pelo Comandante." },
    decision:{ daysAgo:5, type:"Deferir elogio em BI", score:1.0,
      text:"Defiro o Elogio em BI ao sd GARIOLI pelo ato de bravura ao conduzir viatura com segurança após falha mecânica grave em via pública, evitando vítimas." },
    desc:"O sd GARIOLI conduziu com serenidade e habilidade viatura que apresentou falha mecânica grave durante estágio prático, estacionando-a com segurança sem ferir pedestres ou outros condutores." });

  await cc({ id:"t030", proto:"BI - 2026 - 0003 - CFSd 2025",
    typeId:IDS.ebi, rule:R.r170iii, student:cfsd[0], courseId:IDS.cfsd2025,
    factDate:dA(12), communicant:"Cap VIEIRA", status:"AGUARDANDO_PARECER", prazo:dA(7),
    defense:{ daysAgo:8, semDefesa:true },
    desc:"A sd ANGELO organizou mutirão voluntário de limpeza do aquartelamento no final de semana, mobilizando 18 colegas do pelotão e recebendo elogios formais da Direção da Escola." });

  // ── CFO 1 — 8 registros ─────────────────────────────────────────────────
  await cc({ id:"t031", proto:"CPI - 2026 - 0001 - CFO 1",
    typeId:IDS.cpi1, rule:R.r142ib, student:cfo[0], courseId:IDS.cfo1,
    factDate:dA(3), communicant:"Cap TORRES", status:"AGUARDANDO_CIENCIA", prazo:dF(1),
    desc:"O asp of ALMEIDA questionou publicamente decisão do instrutor durante aula teórica, gerando constrangimento e comprometendo a autoridade do docente perante a turma." });

  await cc({ id:"t032", proto:"CPI - 2026 - 0002 - CFO 1",
    typeId:IDS.cpi2, rule:R.r142iiib, student:cfo[1], courseId:IDS.cfo1,
    factDate:dA(8), communicant:"Maj BRANDÃO", status:"AGUARDANDO_PARECER", prazo:dA(3),
    defense:{ daysAgo:5, text:"Reconheço que as palavras foram inadequadas. Não pretendia expor o colega. Peço desculpas e me comprometo a manter postura compatível com o posto que almejo." },
    desc:"O asp of SILVA teceu comentários críticos sobre o desempenho de colega durante exercício de liderança, em tom depreciativo na presença do grupo, comprometendo o clima de confiança." });

  await cc({ id:"t033", proto:"CPI - 2026 - 0003 - CFO 1",
    typeId:IDS.cpi3, rule:R.r142iiia, student:cfo[2], courseId:IDS.cfo1,
    factDate:dA(15), communicant:"Ten Cel MEIRA", status:"AGUARDANDO_DECISAO", prazo:dA(10),
    defense:{ daysAgo:11, text:"Reconheço a gravidade. Estava sob pressão e reagi inadequadamente. Nunca mais agirei dessa forma." },
    opinion:OP_PUN,
    desc:"O asp of COSTA protagonizou conflito físico com colega de curso no vestiário após treino de condicionamento físico, sendo necessária intervenção de instrutores para conter a situação." });

  await cc({ id:"t034", proto:"CPI - 2026 - 0004 - CFO 1",
    typeId:IDS.cpi1, rule:R.r143ia, student:cfo[3], courseId:IDS.cfo1,
    factDate:dA(25), communicant:"Cap MATOS", status:"DECIDIDA", finalScore:0.2, prazo:dA(20),
    defense:{ daysAgo:21, semDefesa:true },
    opinion:OP_PUN, decision:DEC_SAN,
    desc:"A asp of SOUZA ausentou-se sem autorização de atividade curricular obrigatória de simulação de ocorrência policial, prejudicando o exercício de seu grupo." });

  await cc({ id:"t035", proto:"RE - 2026 - 0001 - CFO 1",
    typeId:IDS.re, rule:R.r170iii, student:cfo[4], courseId:IDS.cfo1,
    factDate:dA(10), communicant:"Cel MONTOVANI", status:"AGUARDANDO_PARECER", prazo:dA(5),
    defense:{ daysAgo:7, semDefesa:true },
    desc:"O asp of LEONARDO destacou-se na elaboração de plano de policiamento comunitário, selecionado pelo corpo docente como modelo de excelência para o curso." });

  await cc({ id:"t036", proto:"RE - 2026 - 0002 - CFO 1",
    typeId:IDS.re, rule:R.r170iii, student:cfo[0], courseId:IDS.cfo1,
    factDate:dA(30), communicant:"Maj BRANDÃO", status:"DECIDIDA", finalScore:0.2, prazo:dA(25),
    defense:{ daysAgo:27, semDefesa:true },
    opinion:{ daysAgo:8, rec:"Sugiro homologação (Referência Elogiosa)", text:"Desempenho excepcional que merece reconhecimento formal." },
    decision:{ daysAgo:3, type:"Deferir referência elogiosa", score:0.2,
      text:"Defiro a Referência Elogiosa ao asp of ALMEIDA pelo desempenho destacado e postura exemplar." },
    desc:"O asp of ALMEIDA obteve nota superior a 9,5 em todas as disciplinas do semestre, sendo indicado como monitor voluntário de colegas com dificuldade pelo corpo docente." });

  await cc({ id:"t037", proto:"BI - 2026 - 0001 - CFO 1",
    typeId:IDS.ebi, rule:R.r170iii, student:cfo[1], courseId:IDS.cfo1,
    factDate:dA(45), communicant:"Cel MONTOVANI", status:"DECIDIDA", finalScore:1.0, prazo:dA(40),
    defense:{ daysAgo:42, semDefesa:true },
    opinion:{ daysAgo:12, rec:"Sugiro homologação (Referência Elogiosa)", text:"Ato heróico que deve ser reconhecido formalmente pelo Comandante." },
    decision:{ daysAgo:7, type:"Deferir elogio em BI", score:1.0,
      text:"Defiro o Elogio em BI ao asp of SILVA pelo ato de bravura e espírito público demonstrado." },
    desc:"O asp of SILVA, durante folga, prestou socorro a vítima de assalto nas proximidades da escola, imobilizando o suspeito até a chegada de viatura, sendo elogiado publicamente pelo Comandante Geral da PMES." });

  await cc({ id:"t038", proto:"CPI - 2026 - 0005 - CFO 1",
    typeId:IDS.cpi0, rule:R.r146ia, student:cfo[2], courseId:IDS.cfo1,
    factDate:dA(6), communicant:"Sgt COSTA", status:"AGUARDANDO_CIENCIA", prazo:dF(1),
    desc:"O asp of COSTA foi verificado durante inspeção com coturno sem graxa e crachá de identificação incorretamente afixado no uniforme, em dia de visita de autoridade externa à escola." });

  console.log("✅ 38 registros criados com sucesso:");
  console.log("  CFSd 2025 — 30 registros:");
  console.log("    7 Ag. Ciência | 6 Ag. Parecer | 5 Ag. Decisão");
  console.log("    5 Decidida/Sanção | 4 Decidida/Arquivada | 3 Elogiosos variados");
  console.log("  CFO 1 — 8 registros:");
  console.log("    3 Ag. Ciência/Parecer/Decisão | 2 Decididas | 3 Elogiosos");
}

main().catch(e => { console.error("ERRO:", e.message); process.exit(1); });
