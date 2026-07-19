import { Routes, Route, Navigate, Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext.jsx";
import Login from "./pages/Login.jsx";
import Signup from "./pages/Signup.jsx";
import Upload from "./pages/Upload.jsx";
import Dashboard from "./pages/Dashboard.jsx";

function TopBar() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  if (!user) return null;

  return (
    <header
      style={{
        borderBottom: "1px solid var(--border-soft)",
        padding: "16px 28px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      <Link to="/dashboard" style={{ textDecoration: "none", display: "flex", alignItems: "baseline", gap: 10 }}>
        <span style={{ fontFamily: "var(--serif)", fontSize: 20, fontWeight: 600, color: "var(--ink)" }}>
          Ledger
        </span>
        <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--ink-faint)", letterSpacing: "0.06em" }}>
          RECONCILIATION
        </span>
      </Link>
      <nav style={{ display: "flex", alignItems: "center", gap: 20 }}>
        <Link
          to="/upload"
          style={{
            fontSize: 13.5,
            textDecoration: "none",
            color: loc.pathname === "/upload" ? "var(--gold)" : "var(--ink-muted)",
          }}
        >
          New import
        </Link>
        <span style={{ fontSize: 13, color: "var(--ink-faint)", fontFamily: "var(--mono)" }}>{user.email}</span>
        <button
          className="btn btn-ghost"
          onClick={() => {
            logout();
            nav("/login");
          }}
        >
          Sign out
        </button>
      </nav>
    </header>
  );
}

function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <FullPageLoader />;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

export function FullPageLoader() {
  return (
    <div style={{ height: "100vh", display: "grid", placeItems: "center" }}>
      <span className="spinner" />
    </div>
  );
}

export default function App() {
  const { loading } = useAuth();
  if (loading) return <FullPageLoader />;

  return (
    <div>
      <TopBar />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route
          path="/upload"
          element={
            <RequireAuth>
              <Upload />
            </RequireAuth>
          }
        />
        <Route
          path="/dashboard"
          element={
            <RequireAuth>
              <Dashboard />
            </RequireAuth>
          }
        />
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </div>
  );
}
