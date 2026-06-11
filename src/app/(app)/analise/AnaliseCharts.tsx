"use client";

import Link from "next/link";
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
} from "recharts";

export type DiaSemanaEntry   = { dia: string; total: number };
export type EvolucaoEntry    = { mes: string; CPI: number; "Ref. Elogiosa": number };
export type PelotaoEntry     = { pelotao: string; cpi0: number; cpi1: number; cpi2: number; cpi3: number; total: number };
export type TipoEntry        = { name: string; value: number };
export type ArtigoEntry      = { dispositivo: string; count: number };
export type AlunoEntry       = { studentId: string; warName: string; courseName: string; platoonName: string; total: number };

const PRIMARY     = "#1e3a5f";
const CPI_COLORS  = ["#22c55e", "#eab308", "#f97316", "#ef4444"];
const PIE_COLORS  = ["#1e3a5f", "#2a6496", "#3b82c4", "#60a5fa", "#93c5fd", "#bfdbfe", "#6b7280", "#374151"];

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
  const totalCPIs = pelotaoData.reduce((s, p) => s + p.total, 0);

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
          subtitle="Comunicações por mês: CPIs (desfavoráveis) e Referências Elogiosas (favoráveis)"
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
                  stroke="#22c55e"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <Vazio />
          )}
        </Panel>

        {/* 3 — Comparativo entre pelotões */}
        <Panel
          title="Comparativo entre Pelotões"
          subtitle="CPIs por pelotão agrupadas por grau de gravidade (0 a 3)"
          total={totalCPIs}
        >
          {pelotaoData.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={pelotaoData} margin={{ top: 4, right: 12, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="pelotao" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="cpi0" name="CPI 0" fill={CPI_COLORS[0]} radius={[2, 2, 0, 0]} />
                <Bar dataKey="cpi1" name="CPI 1" fill={CPI_COLORS[1]} radius={[2, 2, 0, 0]} />
                <Bar dataKey="cpi2" name="CPI 2" fill={CPI_COLORS[2]} radius={[2, 2, 0, 0]} />
                <Bar dataKey="cpi3" name="CPI 3" fill={CPI_COLORS[3]} radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[260px] flex items-center justify-center text-gray-400 text-sm">
              Nenhuma CPI registrada no período selecionado
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
                  {tipoData.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => [v, "Comunicações"]} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <Vazio />
          )}
        </Panel>
      </div>

      {/* 5 — Top artigos infringidos */}
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

      {/* 6 — Top 10 alunos */}
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
