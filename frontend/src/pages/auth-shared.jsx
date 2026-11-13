import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { CircleAlert, CircleCheck } from "lucide-react";
import { API_BASE, getUser, saveSession } from "../lib/api";
import { homeFor } from "../lib/format";

/* Solo se aceptan destinos internos ("/sedes/3"), nunca URLs externas. */
function safeNext(value) {
  return value && value.startsWith("/") && !value.startsWith("//") ? value : null;
}

/* Tras entrar: vuelve a donde iba (si le corresponde a su rol) o a su panel. */
export function useSessionRedirect() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = safeNext(params.get("next"));
  return function enter({ token, user }) {
    saveSession(token, user);
    navigate(user.role === "CLIENT" && next ? next : homeFor(user), { replace: true });
  };
}

/* Quien ya tiene sesión no ve login ni registro. */
export function RedirectIfLoggedIn({ children }) {
  const user = getUser();
  return user ? <Navigate to={homeFor(user)} replace /> : children;
}

export function nextSuffix(params) {
  const next = safeNext(params.get("next"));
  return next ? `?next=${encodeURIComponent(next)}` : "";
}

/* POST público de autenticación (sin token ni redirección por 401). */
export async function authPost(path, body, fallback) {
  const response = await fetch(API_BASE + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.message || fallback);
    error.status = response.status;
    throw error;
  }
  return data;
}

export function FormMessage({ tone = "error", children }) {
  if (!children) return null;
  const Icon = tone === "success" ? CircleCheck : CircleAlert;
  return (
    <p
      role={tone === "error" ? "alert" : "status"}
      className={tone === "success"
        ? "flex items-start gap-2 rounded-2xl bg-exito-50 px-4 py-3 text-sm font-medium text-exito-800"
        : "flex items-start gap-2 rounded-2xl bg-rojo-50 px-4 py-3 text-sm font-medium text-rojo-800"}
    >
      <Icon size={18} className="mt-0.5 shrink-0" aria-hidden="true" /> {children}
    </p>
  );
}

export const linkClass = "font-bold text-rojo-700 underline decoration-mostaza-600 decoration-2 underline-offset-4 hover:text-rojo-600";
