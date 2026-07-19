import { useEffect, useState, useCallback } from "react";
import { api, ApiError } from "../api/client.js";
import { typeLabel, fmtMoney } from "./labels.js";

const TYPES = [
  "MISSING_PAYMENT",
  "ORPHAN_PAYMENT",
  "AMOUNT_MISMATCH",
  "DUPLICATE_CHARGE",
  "REFUND_SHORTFALL",
  "PAYMENT_NOT_SETTLED",
  "CANCELLED_BUT_CHARGED",
  "CURRENCY_MISMATCH",
  "DUPLICATE_ORDER_RECORD",
];

function Select({ value, onChange, options, placeholder }) {
  return (
    <select className="input" style={{ width: "auto", padding: "8px 10px" }} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">{placeholder}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export default function DiscrepancyTable({ batchId, onSelect, selectedIds, onToggleSelect, refreshKey }) {
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [type, setType] = useState("");
  const [severity, setSeverity] = useState("");
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");

  const pageSize = 15;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.discrepancies({ batchId, type, severity, status, search, page, pageSize });
      setRows(data.items);
      setTotal(data.total);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load discrepancies.");
    } finally {
      setLoading(false);
    }
  }, [batchId, type, severity, status, search, page, refreshKey]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [type, severity, status, search]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="card" style={{ padding: 20 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 16, alignItems: "center" }}>
        <input
          className="input"
          style={{ maxWidth: 220 }}
          placeholder="Search order ID…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Select
          value={type}
          onChange={setType}
          placeholder="All types"
          options={TYPES.map((t) => ({ value: t, label: typeLabel(t) }))}
        />
        <Select
          value={severity}
          onChange={setSeverity}
          placeholder="All severities"
          options={[
            { value: "high", label: "High" },
            { value: "medium", label: "Medium" },
            { value: "low", label: "Low" },
          ]}
        />
        <Select
          value={status}
          onChange={setStatus}
          placeholder="All statuses"
          options={[
            { value: "open", label: "Open" },
            { value: "resolved", label: "Resolved" },
            { value: "ignored", label: "Ignored" },
          ]}
        />
        <div style={{ marginLeft: "auto", fontSize: 12.5, color: "var(--ink-faint)" }}>
          {total} result{total === 1 ? "" : "s"}
        </div>
      </div>

      {error && (
        <div style={{ color: "var(--risk)", fontSize: 13.5, background: "var(--risk-soft)", padding: "10px 12px", borderRadius: 3, marginBottom: 12 }}>
          {error}
        </div>
      )}

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5 }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)" }}>
              <th style={th}> </th>
              <th style={th}>Order</th>
              <th style={th}>Type</th>
              <th style={th}>Severity</th>
              <th style={{ ...th, textAlign: "right" }}>At risk</th>
              <th style={th}>Status</th>
            </tr>
          </thead>
          <tbody>
            {loading &&
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={i}>
                  <td colSpan={6} style={{ padding: "10px 8px" }}>
                    <div className="skeleton" style={{ height: 18 }} />
                  </td>
                </tr>
              ))}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={6} style={{ padding: "24px 8px", textAlign: "center", color: "var(--ink-faint)" }}>
                  No discrepancies match these filters.
                </td>
              </tr>
            )}
            {!loading &&
              rows.map((r) => (
                <tr
                  key={r._id}
                  onClick={() => onSelect(r._id)}
                  style={{ borderBottom: "1px solid var(--border-soft)", cursor: "pointer" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-hover)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <td style={td} onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(r._id)}
                      onChange={() => onToggleSelect(r._id)}
                    />
                  </td>
                  <td style={{ ...td, fontFamily: "var(--mono)" }}>{r.orderRef}</td>
                  <td style={td}>{typeLabel(r.type)}</td>
                  <td style={td}>
                    <span className={`badge badge-${r.severity}`}>{r.severity}</span>
                  </td>
                  <td style={{ ...td, textAlign: "right", fontFamily: "var(--mono)" }}>
                    {fmtMoney(r.amountAtRisk, r.currency)}
                  </td>
                  <td style={{ ...td, color: "var(--ink-muted)", textTransform: "capitalize" }}>{r.status}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 14 }}>
        <span style={{ fontSize: 12.5, color: "var(--ink-faint)" }}>
          Page {page} of {totalPages}
        </span>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Previous
          </button>
          <button className="btn" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
            Next
          </button>
        </div>
      </div>
    </div>
  );
}

const th = { padding: "8px", fontSize: 11.5, color: "var(--ink-faint)", textTransform: "uppercase", letterSpacing: "0.04em" };
const td = { padding: "10px 8px" };
