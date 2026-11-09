const SESSION_KEY = "reservaya.session";
export const API_BASE = window.location.port === "3000" ? "http://localhost:8080" : "";

export function getSession() {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY) || "null"); } catch { return null; }
}
export function getUser() { return getSession()?.user || null; }
export function saveSession(token, user) {
  localStorage.setItem(SESSION_KEY, JSON.stringify({ token, user }));
}
export function logout() {
  localStorage.removeItem(SESSION_KEY);
  window.location.href = "/login";
}
export function todayIso() {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 10);
}
export function formatDate(value) {
  if (!value) return "";
  const [year, month, day] = String(value).split("-");
  return new Date(Number(year), Number(month) - 1, Number(day))
    .toLocaleDateString("es-CO", { day: "numeric", month: "long" });
}
export async function apiFetch(path, options = {}) {
  const session = getSession();
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  if (session?.token) headers.Authorization = `Bearer ${session.token}`;
  const response = await fetch(API_BASE + path, { ...options, headers });
  const data = await response.json().catch(() => ({}));
  if (response.status === 401) {
    localStorage.removeItem(SESSION_KEY);
    window.location.href = "/login";
    throw new Error("Tu sesión expiró.");
  }
  if (!response.ok) throw new Error(data.message || "No se pudo completar la solicitud.");
  return data;
}

export const STATUS = {
  PENDING: ["Pendiente", "badge-warn"],
  CONFIRMED: ["Confirmada", "badge-ok"],
  CANCELLED: ["Cancelada", "badge-alert"],
  REJECTED: ["Rechazada", "badge-alert"],
  COMPLETED: ["Completada", "badge-off"],
};
export const EVENTS = {
  NONE: "Ninguna",
  ROMANTIC_DINNER: "Cena romántica",
  BIRTHDAY: "Cumpleaños",
  WEDDING: "Boda",
};
