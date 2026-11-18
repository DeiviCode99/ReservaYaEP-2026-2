import { API_BASE } from "./api";

async function authRequest(path, body) {
  const response = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.message || "No se pudo completar la solicitud.");
    error.status = response.status;
    throw error;
  }
  return data;
}

export const authService = {
  login: (email, password) => authRequest("/api/auth/login", { email, password }),
  register: (payload) => authRequest("/api/auth/register", payload),
};
