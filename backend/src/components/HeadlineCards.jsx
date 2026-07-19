function fmt(n, currency = "USD") {
  if (n === null || n === undefined) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(n);
}

function Card({ label, value, sub, accent, big }) {
  return (
    <div className="card" style={{ padding: "18px 20px" }}>
      <div style={{ fontSize: 11.5, color: "var(--ink-faint)", letterSpacing: "0.05em", textTransform: "uppercase" }}>
        {label}
      </div>
      <div
        className={big ? "numeral ledger-total" : "numeral"}
        style={{ fontSize: big ? 30 : 22, marginTop: 8, color: accent || "var(--ink)", fontWeight: 600 }}
      >
        {value}
      </div>
      {sub && <div style={{ fontSize: 12.5, color: "var(--ink-muted)", marginTop: 10 }}>{sub}</div>}
    </div>
  );
}

export default function HeadlineCards({ run }) {
  const currency = "USD";
  const reconciledPct = run.totalOrderValue
    ? Math.round((run.totalReconciledValue / run.totalOrderValue) * 100)
    : 0;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 14 }}>
      <Card label="Orders ingested" value={run.totalOrders} sub={`${run.totalPayments} payment records`} />
      <Card label="Total order value" value={fmt(run.totalOrderValue, currency)} />
      <Card label="Value reconciled" value={fmt(run.totalReconciledValue, currency)} accent="var(--good)" sub={`${reconciledPct}% of order value matches cleanly`} />
      <Card
        label="Total at risk"
        value={fmt(run.totalAtRisk, currency)}
        accent="var(--risk)"
        big
        sub="Sum across all open discrepancies"
      />
      <Card
        label="Discrepancies found"
        value={Object.values(run.discrepancyCounts || {}).reduce((a, b) => a + b, 0)}
        sub={`${Object.keys(run.discrepancyCounts || {}).length} distinct types`}
      />
    </div>
  );
}
