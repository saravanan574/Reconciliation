import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { ApiError } from "../api/client.js";
import AuthShell from "../components/AuthShell.jsx";

export default function Signup() {
  const { register } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await register(email, password);
      nav("/upload");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell title="Create account" subtitle="Set up access to your reconciliation workspace.">
      <form onSubmit={onSubmit} style={{ display: "grid", gap: 14 }}>
        <label style={{ display: "grid", gap: 6 }}>
          <span style={{ fontSize: 13, color: "var(--ink-muted)" }}>Email</span>
          <input
            className="input"
            type="email"
            required
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
          />
        </label>
        <label style={{ display: "grid", gap: 6 }}>
          <span style={{ fontSize: 13, color: "var(--ink-muted)" }}>Password</span>
          <input
            className="input"
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 8 characters"
          />
        </label>
        {error && (
          <div style={{ color: "var(--risk)", fontSize: 13.5, background: "var(--risk-soft)", padding: "8px 10px", borderRadius: 3 }}>
            {error}
          </div>
        )}
        <button className="btn btn-primary" type="submit" disabled={busy} style={{ marginTop: 4 }}>
          {busy ? <span className="spinner" /> : "Create account"}
        </button>
      </form>
      <p style={{ marginTop: 18, fontSize: 13.5, color: "var(--ink-muted)" }}>
        Already have an account?{" "}
        <Link to="/login" style={{ color: "var(--gold)" }}>
          Sign in
        </Link>
      </p>
    </AuthShell>
  );
}
