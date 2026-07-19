import { useState } from "react";
import { api, ApiError } from "../api/client.js";

export default function ExplainPanel({ discrepancyIds, onClose }) {
  const [state, setState] = useState("idle"); // idle | loading | done | error
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  async function run() {
    setState("loading");
    setError(null);
    try {
      const data = await api.explain(discrepancyIds);
      if (!data.ok) {
        setState("error");
        setError(data.error || "The model could not produce an explanation.");
        return;
      }
      setResult(data);
      setState("done");
    } catch (err) {
      setState("error");
      setError(err instanceof ApiError ? err.message : "Could not reach the explanation service.");
    }
  }

  return (
    <div className="card" style={{ padding: 20, borderColor: "var(--gold)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 13.5, fontWeight: 600 }}>AI explanation</div>
          <div style={{ fontSize: 12, color: "var(--ink-faint)" }}>
            {discrepancyIds.length} discrepanc{discrepancyIds.length === 1 ? "y" : "ies"} selected · generated from
            the numbers above, not a new judgment
          </div>
        </div>
        {onClose && (
          <button className="btn btn-ghost" onClick={onClose} style={{ padding: "4px 8px" }}>
            ✕
          </button>
        )}
      </div>

      {state === "idle" && (
        <button className="btn btn-primary" onClick={run}>
          Generate explanation
        </button>
      )}

      {state === "loading" && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, color: "var(--ink-muted)", fontSize: 13.5 }}>
          <span className="spinner" />
          Asking the model to summarize these findings…
        </div>
      )}

      {state === "error" && (
        <div>
          <div style={{ color: "var(--risk)", fontSize: 13.5, background: "var(--risk-soft)", padding: "10px 12px", borderRadius: 3, marginBottom: 10 }}>
            {error}
          </div>
          <button className="btn" onClick={run}>
            Try again
          </button>
        </div>
      )}

      {state === "done" && result && (
        <div style={{ display: "grid", gap: 14 }}>
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6 }}>{result.overall_assessment}</p>
          <div style={{ display: "grid", gap: 10 }}>
            {result.items.map((it, i) => (
              <div key={i} style={{ borderLeft: "2px solid var(--gold)", paddingLeft: 12 }}>
                <div style={{ fontFamily: "var(--mono)", fontSize: 12.5, color: "var(--gold)", marginBottom: 3 }}>
                  {it.order_ref} · confidence: {it.confidence}
                </div>
                <div style={{ fontSize: 13.5, marginBottom: 4 }}>{it.likely_cause}</div>
                <div style={{ fontSize: 13, color: "var(--ink-muted)" }}>
                  <strong style={{ color: "var(--ink)" }}>Recommended: </strong>
                  {it.recommended_action}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
