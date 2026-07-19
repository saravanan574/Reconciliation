import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { typeLabel } from "./labels.js";

const SEVERITY_COLORS = { high: "#c9603a", medium: "#c9a23a", low: "#5c9e82" };

function ChartCard({ title, children, sub }) {
  return (
    <div className="card" style={{ padding: "18px 20px" }}>
      <div style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 2 }}>{title}</div>
      {sub && <div style={{ fontSize: 12, color: "var(--ink-faint)", marginBottom: 10 }}>{sub}</div>}
      <div style={{ height: 260, marginTop: sub ? 0 : 10 }}>{children}</div>
    </div>
  );
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div
      style={{
        background: "#171f16",
        border: "1px solid #2b362a",
        borderRadius: 3,
        padding: "8px 12px",
        fontSize: 12.5,
        fontFamily: "var(--mono)",
      }}
    >
      <div style={{ color: "#ece7d8", marginBottom: 4 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color || p.fill }}>
          {p.name}: {p.name?.toLowerCase().includes("amount") ? `$${Number(p.value).toLocaleString()}` : p.value}
        </div>
      ))}
    </div>
  );
}

export function DiscrepancyByTypeChart({ byType }) {
  const data = [...byType]
    .sort((a, b) => b.amount - a.amount)
    .map((t) => ({ name: typeLabel(t.type), count: t.count, amount: t.amount }));

  return (
    <ChartCard title="Discrepancies by type" sub="Ranked by dollar value at risk">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16, top: 4, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#2b362a" horizontal={false} />
          <XAxis type="number" tick={{ fill: "#9aa695", fontSize: 11 }} axisLine={{ stroke: "#2b362a" }} tickLine={false} />
          <YAxis
            type="category"
            dataKey="name"
            width={140}
            tick={{ fill: "#ece7d8", fontSize: 12 }}
            axisLine={{ stroke: "#2b362a" }}
            tickLine={false}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(211,169,92,0.08)" }} />
          <Bar dataKey="amount" name="Amount at risk" fill="#d3a95c" radius={[0, 2, 2, 0]} maxBarSize={18} />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

export function SeverityDonut({ bySeverity }) {
  const order = ["high", "medium", "low"];
  const data = order
    .map((sev) => bySeverity.find((s) => s.severity === sev) || { severity: sev, count: 0, amount: 0 })
    .filter((d) => d.count > 0);

  const total = data.reduce((a, d) => a + d.count, 0);

  return (
    <ChartCard title="By severity" sub={`${total} open discrepancies`}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} dataKey="count" nameKey="severity" innerRadius={62} outerRadius={92} paddingAngle={3}>
            {data.map((d) => (
              <Cell key={d.severity} fill={SEVERITY_COLORS[d.severity]} stroke="var(--bg-raised)" strokeWidth={2} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          <Legend
            verticalAlign="bottom"
            height={24}
            formatter={(value) => <span style={{ color: "#9aa695", fontSize: 12, textTransform: "capitalize" }}>{value}</span>}
          />
        </PieChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
