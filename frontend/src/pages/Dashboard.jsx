import { useEffect, useState, useCallback } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api, ApiError } from "../api/client.js";
import HeadlineCards from "../components/HeadlineCards.jsx";
import { DiscrepancyByTypeChart, SeverityDonut } from "../components/Charts.jsx";
import DiscrepancyTable from "../components/DiscrepancyTable.jsx";
import DiscrepancyDrawer from "../components/DiscrepancyDrawer.jsx";
import ExplainPanel from "../components/ExplainPanel.jsx";

export default function Dashboard() {
  const [params, setParams] = useSearchParams();
  const batchId = params.get("batchId") || undefined;

  const [batches, setBatches] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [openId, setOpenId] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [showBulkExplain, setShowBulkExplain] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const loadSummary = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [summaryData, batchData] = await Promise.all([api.dashboardSummary(batchId), api.batches()]);
      setSummary(summaryData);
      setBatches(batchData.runs);
      // If no batch was pinned in the URL but a run exists, pin the latest one so
      // filters/table stay consistent with what the cards above are showing.
      if (!batchId && summaryData.run) {
        setParams({ batchId: summaryData.run.batchId }, { replace: true });
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load the dashboard.");
    } finally {
      setLoading(false);
    }
  }, [batchId]);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  function toggleSelect(id) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  if (loading) {
    return (
      <div style={{ maxWidth: 1180, margin: "0 auto", padding: "36px 24px" }}>
        <div className="skeleton" style={{ height: 32, width: 260, marginBottom: 24 }} />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 14, marginBottom: 24 }}>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="skeleton" style={{ height: 96 }} />
          ))}
        </div>
        <div className="skeleton" style={{ height: 280 }} />
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ maxWidth: 720, margin: "80px auto", textAlign: "center" }}>
        <p style={{ color: "var(--risk)" }}>{error}</p>
        <button className="btn" onClick={loadSummary}>
          Retry
        </button>
      </div>
    );
  }

  if (!summary?.run) {
    return (
      <div style={{ maxWidth: 520, margin: "100px auto", textAlign: "center" }}>
        <h1 style={{ fontFamily: "var(--serif)", fontSize: 24 }}>No data imported yet</h1>
        <p style={{ color: "var(--ink-muted)", fontSize: 14 }}>
          Upload an orders export and a payments export to run your first reconciliation.
        </p>
        <Link to="/upload" className="btn btn-primary" style={{ textDecoration: "none", display: "inline-block", marginTop: 12 }}>
          Import data
        </Link>
      </div>
    );
  }

  const { run, byType, bySeverity } = summary;

  return (
    <div style={{ maxWidth: 1180, margin: "0 auto", padding: "32px 24px 80px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 22, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontFamily: "var(--serif)", fontSize: 26, margin: 0 }}>Reconciliation dashboard</h1>
          <p style={{ color: "var(--ink-faint)", fontSize: 12.5, margin: "4px 0 0", fontFamily: "var(--mono)" }}>
            Batch {run.batchId.slice(0, 8)} · {run.ordersFileName} + {run.paymentsFileName} · {new Date(run.createdAt).toLocaleString()}
          </p>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          {batches.length > 1 && (
            <select
              className="input"
              style={{ width: "auto", padding: "8px 10px" }}
              value={run.batchId}
              onChange={(e) => setParams({ batchId: e.target.value })}
            >
              {batches.map((b) => (
                <option key={b.batchId} value={b.batchId}>
                  {new Date(b.createdAt).toLocaleString()}
                </option>
              ))}
            </select>
          )}
          <Link to="/upload" className="btn" style={{ textDecoration: "none" }}>
            + New import
          </Link>
        </div>
      </div>

      <HeadlineCards run={run} />

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 14, margin: "20px 0" }}>
        <DiscrepancyByTypeChart byType={byType} />
        <SeverityDonut bySeverity={bySeverity} />
      </div>

      {run.dataQualityNotes?.length > 0 && (
        <details className="card" style={{ padding: "14px 18px", marginBottom: 20 }}>
          <summary style={{ cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
            Data quality notes from this import ({run.dataQualityNotes.length})
          </summary>
          <ul style={{ margin: "10px 0 0", paddingLeft: 18, fontSize: 13, color: "var(--ink-muted)" }}>
            {run.dataQualityNotes.map((n, i) => (
              <li key={i} style={{ marginBottom: 4 }}>
                {n}
              </li>
            ))}
          </ul>
        </details>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <h2 style={{ fontFamily: "var(--serif)", fontSize: 19, margin: 0 }}>Discrepancies</h2>
        {selectedIds.length > 0 && (
          <button className="btn btn-primary" onClick={() => setShowBulkExplain(true)}>
            Explain {selectedIds.length} selected with AI
          </button>
        )}
      </div>

      {showBulkExplain && selectedIds.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <ExplainPanel
            discrepancyIds={selectedIds}
            onClose={() => {
              setShowBulkExplain(false);
              setSelectedIds([]);
            }}
          />
        </div>
      )}

      <DiscrepancyTable
        batchId={run.batchId}
        onSelect={setOpenId}
        selectedIds={selectedIds}
        onToggleSelect={toggleSelect}
        refreshKey={refreshKey}
      />

      {openId && (
        <DiscrepancyDrawer
          id={openId}
          onClose={() => setOpenId(null)}
          onChanged={() => setRefreshKey((k) => k + 1)}
        />
      )}
    </div>
  );
}
