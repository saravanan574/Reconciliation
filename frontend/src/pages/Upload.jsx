import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiError } from "../api/client.js";

function FilePicker({ label, hint, file, onChange, accept = ".csv" }) {
  const inputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);

  function handleFiles(files) {
    if (files && files[0]) onChange(files[0]);
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        handleFiles(e.dataTransfer.files);
      }}
      onClick={() => inputRef.current?.click()}
      className="card"
      style={{
        padding: 22,
        cursor: "pointer",
        borderStyle: file ? "solid" : "dashed",
        borderColor: dragOver ? "var(--gold)" : file ? "var(--good)" : "var(--border)",
        textAlign: "center",
        transition: "border-color 0.15s ease",
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        hidden
        onChange={(e) => handleFiles(e.target.files)}
      />
      <div style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 12.5, color: "var(--ink-faint)", marginBottom: 10 }}>{hint}</div>
      {file ? (
        <div style={{ fontFamily: "var(--mono)", fontSize: 13, color: "var(--good)" }}>{file.name}</div>
      ) : (
        <div style={{ fontSize: 13, color: "var(--ink-muted)" }}>Click to browse, or drop a .csv file here</div>
      )}
    </div>
  );
}

export default function Upload() {
  const nav = useNavigate();
  const [ordersFile, setOrdersFile] = useState(null);
  const [paymentsFile, setPaymentsFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [stage, setStage] = useState(null); // "uploading" | "reconciling"

  async function onSubmit(e) {
    e.preventDefault();
    if (!ordersFile || !paymentsFile) return;
    setError(null);
    setBusy(true);
    setStage("uploading");
    try {
      // The reconciliation run happens synchronously on the backend as part of
      // this request, so from the user's point of view "uploading" flows
      // straight into "reconciling" without a second request.
      setTimeout(() => setStage("reconciling"), 400);
      const { run } = await api.upload(ordersFile, paymentsFile);
      nav(`/dashboard?batchId=${run.batchId}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Upload failed. Please try again.");
    } finally {
      setBusy(false);
      setStage(null);
    }
  }

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "48px 24px" }}>
      <h1 style={{ fontFamily: "var(--serif)", fontSize: 28, margin: "0 0 6px" }}>Import a new batch</h1>
      <p style={{ color: "var(--ink-muted)", margin: "0 0 32px", fontSize: 14.5 }}>
        Upload your orders export and your payment processor export. They'll be matched and
        reconciled automatically — nothing is charged, refunded, or modified anywhere else.
      </p>

      <form onSubmit={onSubmit} style={{ display: "grid", gap: 16 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <FilePicker
            label="orders.csv"
            hint="Order system export"
            file={ordersFile}
            onChange={setOrdersFile}
          />
          <FilePicker
            label="payments.csv"
            hint="Payment processor export"
            file={paymentsFile}
            onChange={setPaymentsFile}
          />
        </div>

        {error && (
          <div style={{ color: "var(--risk)", fontSize: 13.5, background: "var(--risk-soft)", padding: "10px 12px", borderRadius: 3 }}>
            {error}
          </div>
        )}

        <button
          className="btn btn-primary"
          type="submit"
          disabled={!ordersFile || !paymentsFile || busy}
          style={{ justifySelf: "start", minWidth: 200, display: "flex", alignItems: "center", gap: 8 }}
        >
          {busy ? (
            <>
              <span className="spinner" />
              {stage === "uploading" ? "Uploading files…" : "Running reconciliation…"}
            </>
          ) : (
            "Import and reconcile"
          )}
        </button>
      </form>
    </div>
  );
}
