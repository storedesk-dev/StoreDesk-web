"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";

const SAMPLE = [
  { name: "Coke 12pk", sell: 12.99, bestCost: 8.99, otherCost: 10.2 },
  { name: "Red Bull 24", sell: 54.99, bestCost: 38.99, otherCost: 42.5 },
  { name: "Doritos", sell: 5.49, bestCost: 3.8, otherCost: 4.25 },
  { name: "Milk gal", sell: 4.99, bestCost: 3.15, otherCost: 3.6 }
];

/** Illustrative margin / vendor cost chart for Product page. */
export function VendorCostChart() {
  return (
    <div className="h-[320px] w-full rounded-2xl border border-[var(--border)] bg-white/95 p-4 shadow-md shadow-blue-500/10">
      <p className="mb-2 text-sm font-bold text-[var(--foreground)]">Sample: sell vs vendor cost</p>
      <p className="mb-4 text-xs text-[var(--muted)]">Illustrative only — live numbers come from your vendor price entries.</p>
      <ResponsiveContainer width="100%" height="85%">
        <BarChart data={SAMPLE} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(14,67,216,0.12)" />
          <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#4f5d73" }} />
          <YAxis tick={{ fontSize: 11, fill: "#4f5d73" }} tickFormatter={(v) => `$${v}`} />
          <Tooltip
            formatter={(value) => [`$${Number(value).toFixed(2)}`, undefined]}
            contentStyle={{ borderRadius: 12, borderColor: "rgba(14,67,216,0.16)" }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="sell" name="Sell" fill="#1A63F4" radius={[6, 6, 0, 0]} />
          <Bar dataKey="bestCost" name="Best vendor" fill="#00A87B" radius={[6, 6, 0, 0]} />
          <Bar dataKey="otherCost" name="Other vendor" fill="#94a3b8" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
