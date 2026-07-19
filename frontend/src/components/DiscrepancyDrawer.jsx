import { useEffect, useState } from "react";
import { api, ApiError } from "../api/client.js";
import { typeLabel, fmtMoney, fmtDate } from "./labels.js";
import ExplainPanel from "./ExplainPanel.jsx";

export default function DiscrepancyDrawer({ id, onClose, onChanged }) {
  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setItem(null);
    api
      .discrepancy(id)
      .then((data) => !cancelled && setItem(data.item))
      .catch((err) => !cancelled && setError(err instanceof ApiError ? err.message : "Could not load this discrepancy."))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [id]);

  async function setStatus(status) {
    setUpdating(true);
    try {
      const data = await api.updateDiscrepancy(id, status);
      setItem(data.item);
      onChanged?.();
    } catch {
      // non-fatal; leave item state as-is
    } finally {
      setUpdating(false);
    }
  }

  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", justifyContent: "flex-end", zIndex: 50 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="card"
        style={{ width: 460, maxWidth: "100%", height: "100%", borderRadius: 0, borderLeft: "1px solid var(--border)", overflowY: "auto", padding: 24 }}
      >
        <button className="btn btn-ghost" onClick={onClose} style={{ marginBottom: 12 }}>
          ✕ Close
        </button>

        {loading && (
          <div style={{ display: "grid", gap: 10 }}>
            <div className="skeleton" style={{ height: 24, width: "60%" }} />
            <div className="skeleton" style={{ height: 60 }} />
            <div className="skeleton" style={{ height: 120 }} />
          </div>
        )}

        {error && (
          <div style={{ color: "var(--risk)", fontSize: 13.5, background: "var(--risk-soft)", padding: "10px 12px", borderRadius: 3 }}>
            {error}
          </div>
        )}

        {item && (
          <div style={{ display: "grid", gap: 20 }}>
            <div>
              <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
                <span className={`badge badge-${item.severity}`}>{item.severity}</span>
                <span style={{ fontSize: 12, color: "var(--ink-faint)", textTransform: "capitalize" }}>{item.status}</span>
              </div>
              <h2 style={{ fontFamily: "var(--serif)", fontSize: 22, margin: "0 0 4px" }}>{typeLabel(item.type)}</h2>
              <div style={{ fontFamily: "var(--mono)", fontSize: 13, color: "var(--gold)" }}>{item.orderRef}</div>
            </div>

            <div className="card" style={{ padding: 16, background: "var(--bg)" }}>
              <div style={{ fontSize: 11.5, color: "var(--ink-faint)", textTransform: "uppercase", marginBottom: 4 }}>
                Amount at risk
              </div>
              <div className="numeral" style={{ fontSize: 24, fontWeight: 600, color: "var(--risk)" }}>
                {fmtMoney(item.amountAtRisk, item.currency)}
              </div>
            </div>

            <div>
              <div style={{ fontSize: 11.5, color: "var(--ink-faint)", textTransform: "uppercase", marginBottom: 6 }}>
                What the engine found
              </div>
              <p style={{ fontSize: 13.5, lineHeight: 1.6, margin: 0 }}>{item.summary}</p>
            </div>

            {item.orders?.length > 0 && (
              <DetailTable
                title="Order record"
                rows={item.orders.map((o) => ({
                  "Order ID": o.orderId,
                  Date: fmtDate(o.orderDate),
                  Customer: o.customerEmail || "—",
                  Status: o.status,
                  "Net amount": fmtMoney(o.netAmount, o.currency),
                }))}
              />
            )}

            {item.payments?.length > 0 && (
              <DetailTable
                title={`Payment record${item.payments.length > 1 ? "s" : ""}`}
                rows={item.payments.map((p) => ({
                  Transaction: p.transactionRef,
                  Date: fmtDate(p.processedAt),
                  Type: p.type,
                  Status: p.status,
                  Amount: fmtMoney(p.amount, p.currency),
                }))}
              />
            )}

            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn" disabled={updating || item.status === "resolved"} onClick={() => setStatus("resolved")}>
                Mark resolved
              </button>
              <button className="btn" disabled={updating || item.status === "ignored"} onClick={() => setStatus("ignored")}>
                Ignore
              </button>
              {item.status !== "open" && (
                <button className="btn btn-ghost" disabled={updating} onClick={() => setStatus("open")}>
                  Reopen
                </button>
              )}
            </div>

            <ExplainPanel discrepancyIds={[item._id]} />
          </div>
        )}
      </div>
    </div>
  );
}

function DetailTable({ title, rows }) {
  return (
    <div>
      <div style={{ fontSize: 11.5, color: "var(--ink-faint)", textTransform: "uppercase", marginBottom: 6 }}>{title}</div>
      <div style={{ display: "grid", gap: 8 }}>
        {rows.map((row, i) => (
          <div key={i} className="card" style={{ padding: 12, background: "var(--bg)" }}>
            {Object.entries(row).map(([k, v]) => (
              <div key={k} style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, padding: "2px 0" }}>
                <span style={{ color: "var(--ink-faint)" }}>{k}</span>
                <span style={{ fontFamily: "var(--mono)" }}>{v}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
