import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { ApiError } from "../api/client.js";
import AuthShell from "../components/AuthShell.jsx";

export default function Login() {
  const { login } = useAuth();
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
      await login(email, password);
      nav("/dashboard");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell title="Sign in" subtitle="Access your reconciliation dashboard.">
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
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />
        </label>
        {error && (
          <div style={{ color: "var(--risk)", fontSize: 13.5, background: "var(--risk-soft)", padding: "8px 10px", borderRadius: 3 }}>
            {error}
          </div>
        )}
        <button className="btn btn-primary" type="submit" disabled={busy} style={{ marginTop: 4 }}>
          {busy ? <span className="spinner" /> : "Sign in"}
        </button>
      </form>
      <p style={{ marginTop: 18, fontSize: 13.5, color: "var(--ink-muted)" }}>
        No account yet?{" "}
        <Link to="/signup" style={{ color: "var(--gold)" }}>
          Create one
        </Link>
      </p>
    </AuthShell>
  );
}
