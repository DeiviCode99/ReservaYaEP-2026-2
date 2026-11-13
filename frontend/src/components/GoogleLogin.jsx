import { useEffect, useRef, useState } from "react";
import { API_BASE } from "../lib/api";

/* Botón de Google (Google Identity Services). El client ID lo entrega el
   backend: si GOOGLE_CLIENT_ID no está configurado, el bloque no aparece y
   solo queda el formulario de correo y contraseña. */
export function GoogleLogin({ role, onStart, onSession, onError }) {
  const [clientId, setClientId] = useState("");
  const holder = useRef(null);
  const handlers = useRef({});
  handlers.current = { role, onStart, onSession, onError };

  useEffect(() => {
    let active = true;
    fetch(`${API_BASE}/api/auth/config`)
      .then((response) => (response.ok ? response.json() : {}))
      .then((data) => { if (active) setClientId(data.googleClientId || ""); })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!clientId) return undefined;
    let active = true;
    const render = () => {
      if (!active || !window.google || !holder.current) return;
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: async ({ credential }) => {
          handlers.current.onStart?.();
          try {
            const response = await fetch(`${API_BASE}/api/auth/google`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ credential, role: handlers.current.role }),
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(data.message || "No se pudo entrar con Google.");
            handlers.current.onSession(data);
          } catch (error) {
            handlers.current.onError(error.message);
          }
        },
      });
      window.google.accounts.id.renderButton(holder.current, {
        theme: "outline", size: "large", shape: "pill", text: "continue_with", locale: "es",
      });
    };
    if (window.google) {
      render();
    } else {
      const script = document.createElement("script");
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.onload = render;
      document.head.appendChild(script);
    }
    return () => { active = false; };
  }, [clientId]);

  if (!clientId) return null;
  return (
    <div className="mt-6">
      <p className="flex items-center gap-3 text-sm text-piedra-600" aria-hidden="true">
        <span className="h-px flex-1 bg-piedra-300" /> o <span className="h-px flex-1 bg-piedra-300" />
      </p>
      <div ref={holder} className="mt-4 flex justify-center" />
    </div>
  );
}
