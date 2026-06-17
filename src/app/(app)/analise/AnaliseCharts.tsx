"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { abreviarPelotao, platoonOrder } from "@/lib/utils";
import { CPI_FILL } from "@/lib/coresComunicacao";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
  LineChart,
  Line,
  Legend,
  PieChart,
  Pie,
  Cell,
  LabelList,
} from "recharts";

export type DiaSemanaEntry   = { dia: string; total: number };
export type EvolucaoEntry    = {
  mes: string;
  CPI: number;
  "Ref. Elogiosa": number;
  "CPI (ano ant.)"?: number;
  "Ref. Elogiosa (ano ant.)"?: number;
};
export type PelotaoEntry     = { pelotao: string; cpi1: number; cpi2: number; cpi3: number; refElogiosa: number; total: number };
export type TipoEntry        = { name: string; value: number };
export type ArtigoEntry      = { dispositivo: string; count: number };
export type AlunoEntry       = { studentId: string; warName: string; courseName: string; platoonName: string; total: number };

const PRIMARY     = "#1e3a5f";
// Escala de gravidade crescente: amarelo claro (CPI 0) → vermelho vivo (CPI 3).
// Fonte única compartilhada com o Caderno Disciplinar (tela e PDF).
const CPI_COLORS  = CPI_FILL;
const REF_COLOR   = "#07e03a"; // verde — Referência Elogiosa
const REF_BI_COLOR = "#10ad17"; // verde — Elogio publicado em BI
const NEUTRO      = "#6b7280"; // cinza — demais tipos (ex.: Arquivamento)

// Cor de cada fatia do gráfico de pizza conforme o tipo de comunicação,
// seguindo o mesmo padrão das CPIs (0→3) e das referências favoráveis.
function corPorTipo(nome: string): string {
  const lower = nome.toLowerCase();
  const cpi = lower.match(/cpi\s*(\d)/);
  if (cpi) return CPI_COLORS[Math.min(3, parseInt(cpi[1], 10))];
  if (lower.includes("elogi") || lower.includes("refer")) {
    return lower.includes("bi") || lower.includes("boletim") ? REF_BI_COLOR : REF_COLOR;
  }
  return NEUTRO;
}

function Panel({
  title,
  subtitle,
  total,
  children,
}: {
  title: string;
  subtitle: string;
  total: number;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="mb-4">
        <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
        <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>
        <p className="text-xs text-gray-400 mt-1">{total} registro(s) considerado(s)</p>
      </div>
      {children}
    </div>
  );
}

function Vazio() {
  return (
    <div className="h-[260px] flex items-center justify-center text-gray-400 text-sm">
      Nenhuma comunicação no período selecionado
    </div>
  );
}

// Botão-caixa selecionável usado no filtro do comparativo entre pelotões.
function Chip({
  ativo,
  onClick,
  children,
}: {
  ativo: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${
        ativo
          ? "bg-[#1e3a5f] text-white border-[#1e3a5f]"
          : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
      }`}
    >
      {children}
    </button>
  );
}

// Caixa de detalhamento exibida ao passar o mouse sobre a barra de um pelotão:
// sempre mostra a quantidade de cada tipo de comunicação, independente do filtro.
function PelotaoTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: PelotaoEntry }>;
}) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  const totalCpi = p.cpi1 + p.cpi2 + p.cpi3;
  const linha = (cor: string, rotulo: string, n: number) => (
    <div className="flex items-center justify-between gap-4">
      <span className="flex items-center gap-1.5">
        <span className="inline-block w-2 h-2 rounded-sm" style={{ background: cor }} />
        {rotulo}
      </span>
      <span className="font-medium tabular-nums">{n}</span>
    </div>
  );
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm px-3 py-2 text-xs text-gray-700 space-y-1">
      <p className="font-semibold text-gray-900 mb-1">{p.pelotao}</p>
      {linha(CPI_COLORS[1], "CPI 1", p.cpi1)}
      {linha(CPI_COLORS[2], "CPI 2", p.cpi2)}
      {linha(CPI_COLORS[3], "CPI 3", p.cpi3)}
      <div className="flex items-center justify-between gap-4 border-t border-gray-100 pt-1">
        <span>Total CPIs</span>
        <span className="font-medium tabular-nums">{totalCpi}</span>
      </div>
      {linha(REF_COLOR, "Ref. Elogiosa", p.refElogiosa)}
    </div>
  );
}

export default function AnaliseCharts({
  total,
  diaSemanaData,
  evolucaoMensalData,
  pelotaoData,
  tipoData,
  topArtigos,
  topAlunos,
}: {
  total: number;
  diaSemanaData: DiaSemanaEntry[];
  evolucaoMensalData: EvolucaoEntry[];
  pelotaoData: PelotaoEntry[];
  tipoData: TipoEntry[];
  topArtigos: ArtigoEntry[];
  topAlunos: AlunoEntry[];
}) {
  const hasComparison = evolucaoMensalData.some((d) => d["CPI (ano ant.)"] !== undefined);

  // ── Filtro do comparativo entre pelotões ────────────────────────────────────
  const [categoria, setCategoria] = useState<"CPI" | "REF">("CPI");
  const [grauCpi, setGrauCpi]     = useState<"todas" | "1" | "2" | "3">("todas");

  const pelotaoFiltrado = useMemo(() => {
    const valorDe = (p: PelotaoEntry) => {
      if (categoria === "REF") return p.refElogiosa;
      switch (grauCpi) {
        case "1": return p.cpi1;
        case "2": return p.cpi2;
        case "3": return p.cpi3;
        default:  return p.cpi1 + p.cpi2 + p.cpi3;
      }
    };
    return pelotaoData
      .map((p) => ({ ...p, valor: valorDe(p) }))
      .sort((a, b) => platoonOrder(a.pelotao) - platoonOrder(b.pelotao));
  }, [pelotaoData, categoria, grauCpi]);

  const totalFiltrado = pelotaoFiltrado.reduce((s, p) => s + p.valor, 0);
  const corBarra =
    categoria === "REF" ? REF_COLOR
    : grauCpi === "todas" ? PRIMARY
    : CPI_COLORS[Number(grauCpi)];
  const rotuloBarra =
    categoria === "REF" ? "Ref. Elogiosa"
    : grauCpi === "todas" ? "CPIs (todas)"
    : `CPI ${grauCpi}`;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* 1 — Frequência por dia da semana */}
        <Panel
          title="Frequência por Dia da Semana"
          subtitle="Quantidade de fatos registrados em cada dia da semana"
          total={total}
        >
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={diaSemanaData} margin={{ top: 4, right: 12, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="dia" tick={{ fontSize: 12 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
              <Tooltip cursor={{ fill: "#f0f4f8" }} />
              <Bar dataKey="total" fill={PRIMARY} radius={[4, 4, 0, 0]} name="Comunicações" />
            </BarChart>
          </ResponsiveContainer>
        </Panel>

        {/* 2 — Evolução mensal */}
        <Panel
          title="Evolução Mensal"
          subtitle={hasComparison
            ? "Período atual (linha cheia) vs. mesmo período do ano anterior (tracejado)"
            : "Comunicações por mês: CPIs (desfavoráveis) e Referências Elogiosas (favoráveis)"}
          total={total}
        >
          {evolucaoMensalData.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={evolucaoMensalData} margin={{ top: 4, right: 12, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="CPI" stroke="#ef4444" strokeWidth={2} dot={{ r: 3 }} />
                <Line
                  type="monotone"
                  dataKey="Ref. Elogiosa"
                  stroke="#07e03a"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
                {hasComparison && (
                  <>
                    <Line
                      type="monotone"
                      dataKey="CPI (ano ant.)"
                      stroke="#ef4444"
                      strokeWidth={1.5}
                      strokeDasharray="5 5"
                      dot={false}
                      opacity={0.5}
                    />
                    <Line
                      type="monotone"
                      dataKey="Ref. Elogiosa (ano ant.)"
                      stroke="#07e03a"
                      strokeWidth={1.5}
                      strokeDasharray="5 5"
                      dot={false}
                      opacity={0.5}
                    />
                  </>
                )}
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <Vazio />
          )}
        </Panel>

      </div>

      {/* 3 — Comparativo entre pelotões (largura total: até 28 pelotões) */}
      <Panel
        title="Comparativo entre Pelotões"
        subtitle={`Uma barra por pelotão — exibindo ${rotuloBarra}. Passe o mouse para ver o detalhamento por tipo.`}
        total={totalFiltrado}
      >
        {/* Filtro: tipo de registro e, para CPI, o grau */}
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mb-4">
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-gray-500">Registro:</span>
            <Chip ativo={categoria === "CPI"} onClick={() => setCategoria("CPI")}>CPI</Chip>
            <Chip ativo={categoria === "REF"} onClick={() => setCategoria("REF")}>Ref. Elogiosa</Chip>
          </div>
          {categoria === "CPI" && (
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-gray-500">Grau:</span>
              <Chip ativo={grauCpi === "todas"} onClick={() => setGrauCpi("todas")}>Todas</Chip>
              <Chip ativo={grauCpi === "1"} onClick={() => setGrauCpi("1")}>CPI 1</Chip>
              <Chip ativo={grauCpi === "2"} onClick={() => setGrauCpi("2")}>CPI 2</Chip>
              <Chip ativo={grauCpi === "3"} onClick={() => setGrauCpi("3")}>CPI 3</Chip>
            </div>
          )}
        </div>

        {pelotaoFiltrado.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={pelotaoFiltrado} margin={{ top: 24, right: 12, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="pelotao"
                tick={{ fontSize: 11 }}
                interval={0}
                tickFormatter={abreviarPelotao}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fontSize: 12 }}
                domain={[0, (dataMax: number) => Math.ceil(dataMax * 1.12) || 1]}
              />
              <Tooltip cursor={{ fill: "#f0f4f8" }} content={<PelotaoTooltip />} />
              <Bar dataKey="valor" name={rotuloBarra} fill={corBarra} radius={[4, 4, 0, 0]}>
                <LabelList
                  dataKey="valor"
                  position="top"
                  fill="#000000"
                  fontSize={11}
                  formatter={(v) => {
                    const n = Number(v);
                    return n > 0
                      ? `${n} (${totalFiltrado > 0 ? ((n / totalFiltrado) * 100).toFixed(0) : 0}%)`
                      : "";
                  }}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-[300px] flex items-center justify-center text-gray-400 text-sm">
            Nenhum registro no período selecionado
          </div>
        )}
      </Panel>

      {/* 4 — Distribuição por tipo */}
      <Panel
        title="Distribuição por Tipo"
        subtitle="Percentual de cada tipo de comunicação no período"
        total={total}
      >
        {tipoData.length > 0 ? (
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie
                data={tipoData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={95}
                label={({ name, percent }: { name?: string; percent?: number }) =>
                  `${name ?? ""} ${((percent ?? 0) * 100).toFixed(0)}%`
                }
                labelLine
              >
                {tipoData.map((t, i) => (
                  <Cell key={i} fill={corPorTipo(t.name)} />
                ))}
              </Pie>
              <Tooltip formatter={(v) => [v, "Comunicações"]} />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <Vazio />
        )}
      </Panel>

      {/* 6 — Top artigos infringidos */}
      <Panel
        title="Top 10 Artigos Infringidos"
        subtitle="Dispositivos legais mais frequentes nas comunicações do período"
        total={topArtigos.reduce((s, a) => s + a.count, 0)}
      >
        {topArtigos.length > 0 ? (
          <ResponsiveContainer width="100%" height={Math.max(260, topArtigos.length * 36 + 20)}>
            <BarChart
              data={topArtigos}
              layout="vertical"
              margin={{ top: 4, right: 32, left: 8, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} />
              <YAxis type="category" dataKey="dispositivo" width={170} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="count" fill={PRIMARY} radius={[0, 4, 4, 0]} name="Ocorrências" />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-[200px] flex items-center justify-center text-gray-400 text-sm">
            Nenhum artigo registrado no período selecionado
          </div>
        )}
      </Panel>

      {/* 7 — Top 10 alunos */}
      <Panel
        title="Top 10 Alunos com Mais Sanções"
        subtitle="Alunos com maior número de comunicações no período filtrado"
        total={total}
      >
        {topAlunos.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-3 py-2 text-xs font-medium text-gray-700">#</th>
                  <th className="text-left px-3 py-2 text-xs font-medium text-gray-700">Nome de guerra</th>
                  <th className="text-left px-3 py-2 text-xs font-medium text-gray-700">Curso</th>
                  <th className="text-left px-3 py-2 text-xs font-medium text-gray-700">Pelotão</th>
                  <th className="text-right px-3 py-2 text-xs font-medium text-gray-700">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {topAlunos.map((a, i) => (
                  <tr key={i} className={i < 3 ? "bg-red-50" : "hover:bg-gray-50"}>
                    <td className="px-3 py-2.5 text-xs font-bold text-gray-500 w-10">{i + 1}º</td>
                    <td className="px-3 py-2.5 text-xs font-medium text-gray-900">
                      <Link href={`/alunos/${a.studentId}`} className="hover:text-[#1e3a5f] hover:underline">
                        {a.warName}
                      </Link>
                    </td>
                    <td className="px-3 py-2.5 text-xs text-gray-500">{a.courseName}</td>
                    <td className="px-3 py-2.5 text-xs text-gray-500">{a.platoonName}</td>
                    <td className="px-3 py-2.5 text-xs font-bold text-right text-[#1e3a5f]">
                      {a.total}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-8 text-center text-gray-400 text-sm">
            Nenhuma comunicação no período selecionado
          </div>
        )}
      </Panel>
    </div>
  );
}
