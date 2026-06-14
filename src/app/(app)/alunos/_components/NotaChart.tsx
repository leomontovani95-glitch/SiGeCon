"use client";
import {
  LineChart, Line, XAxis, YAxis, Tooltip,
  CartesianGrid, ResponsiveContainer, ReferenceLine,
} from "recharts";

type Ponto = { label: string; nota: number };

export default function NotaChart({ data }: { data: Ponto[] }) {
  const valores = data.map((d) => d.nota);
  const minY = Math.max(0, Math.floor(Math.min(...valores)) - 0.5);
  const maxY = Math.min(12, Math.ceil(Math.max(...valores)) + 0.5);

  return (
    <ResponsiveContainer width="100%" height={160}>
      <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -16 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="label" tick={{ fontSize: 10 }} />
        <YAxis domain={[minY, maxY]} tick={{ fontSize: 10 }} />
        <ReferenceLine y={7} stroke="#ef4444" strokeDasharray="4 3" label={{ value: "7,0", position: "insideTopLeft", fontSize: 9, fill: "#ef4444" }} />
        <Tooltip formatter={(v) => [Number(v).toFixed(2), "Nota"]} />
        <Line
          type="monotone"
          dataKey="nota"
          stroke="#1e3a5f"
          strokeWidth={2}
          dot={{ r: 3, fill: "#1e3a5f" }}
          activeDot={{ r: 5 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
