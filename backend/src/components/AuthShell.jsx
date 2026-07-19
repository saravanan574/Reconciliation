export default function AuthShell({ title, subtitle, children }) {
  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 20 }}>
      <div style={{ width: "100%", maxWidth: 380 }}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ fontFamily: "var(--serif)", fontSize: 30, fontWeight: 600 }}>Ledger</div>
          <div style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--ink-faint)", letterSpacing: "0.08em", marginTop: 2 }}>
            RECONCILIATION
          </div>
        </div>
        <div className="card" style={{ padding: 28 }}>
          <h1 style={{ fontFamily: "var(--serif)", fontSize: 22, margin: "0 0 4px" }}>{title}</h1>
          <p style={{ margin: "0 0 22px", fontSize: 13.5, color: "var(--ink-muted)" }}>{subtitle}</p>
          {children}
        </div>
      </div>
    </div>
  );
}
