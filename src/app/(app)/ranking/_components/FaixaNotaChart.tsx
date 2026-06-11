"use client";

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";

export type FaixaNotaEntry = { faixa: string; quantidade: number; cor: string };

export default function FaixaNotaChart({ data }: { data: FaixaNotaEntry[] }) {
  const total = data.reduce((s, e) => s + e.quantidade, 0);

  if (total === 0) {
    return (
      <div className="h-[220px] flex items-center justify-center text-gray-400 text-sm">
        Nenhum aluno ativo com notas publicadas
      </div>
    );
  }

  return (
    <div>
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie
            data={data}
            dataKey="quantidade"
            nameKey="faixa"
            cx="50%"
            cy="50%"
            outerRadius={90}
            minAngle={15}
            labelLine={false}
          >
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.cor} />
            ))}
          </Pie>
          <Tooltip
            formatter={(v, name) => [
              `${v as number} aluno(s) — ${(((v as number) / total) * 100).toFixed(1)}%`,
              name,
            ]}
          />
        </PieChart>
      </ResponsiveContainer>

      <div className="flex flex-wrap justify-center gap-x-5 gap-y-2 mt-2">
        {data.map((entry) => (
          <div key={entry.faixa} className="flex items-center gap-1.5 text-xs text-gray-600">
            <span
              className="inline-block w-3 h-3 rounded-sm flex-shrink-0"
              style={{ backgroundColor: entry.cor }}
            />
            <span className="font-medium">{entry.faixa}:</span>
            {" "}{entry.quantidade}
            {" "}
            <span className="text-gray-400">
              ({total > 0 ? ((entry.quantidade / total) * 100).toFixed(0) : 0}%)
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
