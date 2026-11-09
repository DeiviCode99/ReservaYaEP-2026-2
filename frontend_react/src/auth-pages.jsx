import React, { useEffect, useState } from "react";
import { AuthLayout, FormField, Status } from "./components";
import { API_BASE, getUser, saveSession } from "./api";

function Password({ value, onChange, autoComplete }) {
  const [visible, setVisible] = useState(false);
  return <div className="password-field"><input type={visible ? "text" : "password"} value={value} onChange={onChange} autoComplete={autoComplete} required /><button className="password-toggle" type="button" onPointerDown={(e) => { e.preventDefault(); setVisible(true); }} onPointerUp={() => setVisible(false)} onPointerLeave={() => setVisible(false)} aria-label="Mantén pulsado para ver la contraseña">◉</button></div>;
}
function useAuthRedirect() {
  const user = getUser();
  if (user) window.location.replace(user.role === "RESTAURANT_ADMIN" ? "/admin" : "/cliente");
}
function GoogleLogin({ role, onStatus }) {
  const [clientId, setClientId] = useState("");
  useEffect(() => {
    let active = true;
    fetch(API_BASE + "/api/auth/config")
      .then((response) => response.ok ? response.json() : {})
      .then((data) => { if (active) setClientId(data.googleClientId || ""); })
      .catch(() => {});
    return () => { active = false; };
  }, []);
  useEffect(() => {
    if (!clientId) return;
    const render = () => {
      if (!window.google || !document.querySelector("[data-google-button]")) return;
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: async ({ credential }) => {
          onStatus("Entrando con Google...");
          try {
            const response = await fetch(API_BASE + "/api/auth/google", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ credential, role }),
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(data.message || "No se pudo entrar con Google.");
            saveSession(data.token, data.user);
            window.location.href = data.user.role === "RESTAURANT_ADMIN" ? "/admin" : "/cliente";
          } catch (error) { onStatus(error.message); }
        },
      });
      window.google.accounts.id.renderButton(document.querySelector("[data-google-button]"), {
        theme: "outline", size: "large", shape: "rectangular", text: "continue_with", locale: "es",
      });
    };
    if (window.google) render();
    else {
      const script = document.createElement("script");
      script.src = "https://accounts.google.com/gsi/client";
      script.onload = render;
      document.head.appendChild(script);
    }
  }, [clientId, role, onStatus]);
  if (!clientId) return null;
  return <div className="google-login"><p className="auth-divider"><span>o</span></p><div data-google-button className="google-button" /></div>;
}
export function Login() {
  useAuthRedirect();
  const [form, setForm] = useState({ email: "", password: "" });
  const [status, setStatus] = useState("");
  async function submit(event) {
    event.preventDefault(); setStatus("Iniciando sesión...");
    try {
      const response = await fetch(API_BASE + "/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(response.status === 401 ? "Correo o contraseña incorrectos." : data.message || "No se pudo iniciar sesión.");
      saveSession(data.token, data.user); window.location.href = data.user.role === "RESTAURANT_ADMIN" ? "/admin" : "/cliente";
    } catch (error) { setStatus(error.message); }
  }
  return <AuthLayout title="Otra vez a la mesa." lead="Entra para ver tus reservas, cambiar la hora o administrar las sedes de tu restaurante."><nav className="auth-switch">¿Primera vez aquí? <a href="/">Crea tu cuenta</a></nav><section className="auth-card"><h2>Iniciar sesión</h2><p className="auth-card-lead">Entra con el correo con el que te registraste.</p><form onSubmit={submit}><FormField label="Correo electrónico"><input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></FormField><FormField label="Contraseña"><Password value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} autoComplete="current-password" /></FormField><a className="forgot-link" href="/recuperar">¿Olvidaste tu contraseña?</a><div className="form-actions"><button className="button">Iniciar sesión</button></div><Status message={status} tone={status.includes("inici") ? "" : "error"} /></form><GoogleLogin role="CLIENT" onStatus={setStatus} /></section></AuthLayout>;
}
export function Register() {
  useAuthRedirect();
  const [form, setForm] = useState({ name: "", email: "", password: "", confirm: "", role: "CLIENT" });
  const [status, setStatus] = useState("");
  async function submit(event) {
    event.preventDefault();
    if (form.password.length < 8 || form.password !== form.confirm) return setStatus("Revisa la contraseña y su confirmación.");
    try {
      const response = await fetch(API_BASE + "/api/auth/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: form.name, email: form.email, password: form.password, role: form.role }) });
      const data = await response.json().catch(() => ({})); if (!response.ok) throw new Error(data.message || "No se pudo crear la cuenta.");
      saveSession(data.token, data.user); window.location.href = form.role === "RESTAURANT_ADMIN" ? "/admin" : "/cliente";
    } catch (error) { setStatus(error.message); }
  }
  return <AuthLayout title="Tu mesa te está esperando." lead="Reserva en los restaurantes de tu ciudad y llega directo a la mesa, sin llamadas ni filas en la puerta."><nav className="auth-switch">¿Ya tienes cuenta? <a href="/login">Inicia sesión</a></nav><section className="auth-card"><h2>Crear cuenta</h2><p className="auth-card-lead">Toma menos de un minuto. Solo necesitas un correo y una contraseña.</p><form onSubmit={submit}><fieldset className="role-selector"><legend className="role-legend">¿Cómo vas a usar ReservaYa?</legend><div className="role-options">{[["CLIENT", "Quiero reservar"], ["RESTAURANT_ADMIN", "Tengo un restaurante"]].map(([value, label]) => <label className="role-option" key={value}><input type="radio" name="role" checked={form.role === value} onChange={() => setForm({ ...form, role: value })} /><span className="role-card"><span className="role-card-title">{label}</span><span className="role-card-desc">{value === "CLIENT" ? "Busca mesa y gestiona tus reservas." : "Registra tus sedes, horarios y aforo."}</span></span></label>)}</div></fieldset><FormField label="Nombre"><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} minLength="2" required /></FormField><FormField label="Correo electrónico"><input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></FormField><FormField label="Contraseña"><Password value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} autoComplete="new-password" /></FormField><FormField label="Repite la contraseña"><input type="password" value={form.confirm} onChange={(e) => setForm({ ...form, confirm: e.target.value })} required /></FormField><div className="form-actions"><button className="button">Crear cuenta</button></div><Status message={status} tone="error" /></form><GoogleLogin role={form.role} onStatus={setStatus} /></section></AuthLayout>;
}
export function Recover() {
  const token = new URLSearchParams(window.location.search).get("token");
  const [email, setEmail] = useState(""); const [password, setPassword] = useState(""); const [confirm, setConfirm] = useState(""); const [status, setStatus] = useState("");
  async function submitRequest(e) { e.preventDefault(); setStatus("Enviando..."); try { const response = await fetch(API_BASE + "/api/auth/forgot-password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) }); const data = await response.json().catch(() => ({})); if (!response.ok) throw new Error(data.message || "No se pudo enviar el enlace."); setStatus(`${data.message || "Si el correo existe, recibirás instrucciones."} Revisa también la carpeta de spam.`); } catch (error) { setStatus(error.message); } }
  async function submitReset(e) { e.preventDefault(); if (password.length < 8) return setStatus("La contraseña debe tener al menos 8 caracteres."); if (password !== confirm) return setStatus("Las contraseñas no coinciden."); setStatus("Guardando..."); try { const response = await fetch(API_BASE + "/api/auth/reset-password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, password }) }); const data = await response.json().catch(() => ({})); if (!response.ok) throw new Error(data.message || "El enlace no es válido o ya venció."); saveSession(data.token, data.user); window.location.href = data.user.role === "RESTAURANT_ADMIN" ? "/admin" : "/cliente"; } catch (error) { setStatus(error.message); } }
  return <AuthLayout title="Nadie se queda sin mesa." lead="Te enviamos un enlace a tu correo para que elijas una contraseña nueva. Tus reservas siguen donde las dejaste."><nav className="auth-switch"><span>¿Ya la recordaste?</span> <a href="/login">Inicia sesión</a></nav><section className="auth-card"><h2>{token ? "Nueva contraseña" : "Recuperar cuenta"}</h2><p className="auth-card-lead">{token ? "Elige una contraseña de al menos 8 caracteres. Al guardarla entrarás directo a tu cuenta." : "Escribe el correo de tu cuenta y te enviaremos un enlace que vence en 30 minutos."}</p>{token ? <form onSubmit={submitReset}><FormField label="Contraseña nueva"><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength="8" maxLength="72" required /></FormField><FormField label="Repite la contraseña"><input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required /></FormField><div className="form-actions"><button className="button">Guardar y entrar</button></div></form> : <form onSubmit={submitRequest}><FormField label="Correo electrónico"><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></FormField><div className="form-actions"><button className="button">Enviar enlace</button></div></form>}<Status message={status} tone={status.includes("enviado") || status.includes("instrucciones") ? "success" : "error"} /></section></AuthLayout>;
}
