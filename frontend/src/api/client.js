const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000/api";

function getToken() {
  return localStorage.getItem("token");
}

async function request(path, { method = "GET", body, isForm = false, auth = true } = {}) {
  const headers = {};
  if (!isForm) headers["Content-Type"] = "application/json";
  if (auth) {
    const token = getToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }

  let res;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: isForm ? body : body ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    throw new ApiError("Could not reach the server. Check your connection and try again.", 0);
  }

  let data = null;
  const text = await res.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }

  if (!res.ok) {
    throw new ApiError(data?.error || `Request failed (${res.status})`, res.status);
  }
  return data;
}

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

export const api = {
  register: (email, password) => request("/auth/register", { method: "POST", body: { email, password }, auth: false }),
  login: (email, password) => request("/auth/login", { method: "POST", body: { email, password }, auth: false }),
  me: () => request("/auth/me"),

  upload: (ordersFile, paymentsFile) => {
    const form = new FormData();
    form.append("orders", ordersFile);
    form.append("payments", paymentsFile);
    return request("/ingest/upload", { method: "POST", body: form, isForm: true });
  },
  batches: () => request("/ingest/batches"),

  dashboardSummary: (batchId) => request(`/dashboard/summary${batchId ? `?batchId=${batchId}` : ""}`),

  discrepancies: (params) => {
    const qs = new URLSearchParams(
      Object.fromEntries(Object.entries(params || {}).filter(([, v]) => v !== undefined && v !== ""))
    ).toString();
    return request(`/discrepancies${qs ? `?${qs}` : ""}`);
  },
  discrepancy: (id) => request(`/discrepancies/${id}`),
  updateDiscrepancy: (id, status) => request(`/discrepancies/${id}`, { method: "PATCH", body: { status } }),

  explain: (discrepancyIds) => request("/explain", { method: "POST", body: { discrepancyIds } }),
};

export { getToken };
