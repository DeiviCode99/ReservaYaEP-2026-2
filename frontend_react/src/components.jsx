import React, { useEffect, useState } from "react";
import { apiFetch, getUser, logout, STATUS } from "./api";

export function Status({ message, tone = "" }) {
  return <p className={`status ${tone ? `is-${tone}` : ""}`} aria-live="polite">{message || ""}</p>;
}

export function Badge({ status }) {
  const [label, style] = STATUS[status] || [status, ""];
  return <span className={`badge ${style}`}>{label}</span>;
}

export function Notifications({ check }) {
  const [messages, setMessages] = useState([]);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    let active = true;
    const run = async () => {
      try {
        const next = await check();
        if (active && next.length) setMessages((current) => [...next, ...current].slice(0, 20));
      } catch {
        // El siguiente ciclo reintenta si la sesión o la red no están disponibles.
      }
    };
    run();
    const timer = setInterval(run, 15000);
    return () => { active = false; clearInterval(timer); };
  }, [check]);
  return <div className="notify">
    <button className="notify-bell" type="button" aria-expanded={open} aria-label="Notificaciones" onClick={() => setOpen(!open)}>
      <span aria-hidden="true">♢</span>{messages.length > 0 && <span className="notify-count">{messages.length > 9 ? "9+" : messages.length}</span>}
    </button>
    {open && <div className="notify-panel"><p className="notify-title">Notificaciones</p>{messages.length ? <ul className="notify-list">{messages.map((message, index) => <li key={`${message}-${index}`}>{message}</li>)}</ul> : <p className="notify-empty">Sin novedades por ahora.</p>}</div>}
  </div>;
}

export function Header({ admin = false, notificationCheck }) {
  const user = getUser();
  return <header className="site-header"><nav className="container navigation" aria-label="Navegación principal">
    <a className="brand" href={admin ? "/admin" : "/cliente"}><img className="brand-mark" src="/images/logo-reservaya.svg" alt="" /><span>ReservaYa</span></a>
    <div className="nav-actions">{notificationCheck && <Notifications check={notificationCheck} />}<span className="session-label">{user?.name}</span><button className="button button-small button-outline" onClick={logout}>Cerrar sesión</button></div>
  </nav></header>;
}

export function Layout({ children, admin = false, notificationCheck }) {
  return <><Header admin={admin} notificationCheck={notificationCheck} /><main className="container page">{children}</main><footer className="site-footer"><div className="container">ReservaYa, plataforma de reservas. Proyecto de Entornos de Programación, UIS 2026.</div></footer></>;
}

export function AuthLayout({ children, title, lead }) {
  return <div className="auth-layout"><aside className="auth-aside"><a className="brand" href="/"><img className="brand-mark" src="/images/logo-reservaya.svg" alt="" /><span>ReservaYa</span></a><div><h1 className="hero-title">{title}</h1><p className="hero-lead">{lead}</p><ul className="hero-points"><li>Elige sede, día y hora según la disponibilidad real.</li><li>Sigue el estado de tu reserva desde tu panel.</li><li>Administra tus restaurantes y sedes.</li></ul></div><p className="auth-aside-foot">Proyecto de Entornos de Programación, UIS 2026</p></aside><main className="auth-main">{children}</main></div>;
}

export function FormField({ label, error, children }) {
  return <><label>{label}</label>{children}{error && <p className="field-error">{error}</p>}</>;
}
