import { useEffect, useRef, useState } from "react";
import { Bell } from "lucide-react";
import { useToast } from "./ui/Toast";

const INTERVAL_MS = 15000;

/* Campanita del header. `check` consulta el backend y devuelve los mensajes
   nuevos. Se revisa al cargar, cada 15 s y al volver a la pestaña. */
export function Notifications({ check }) {
  const toast = useToast();
  const [messages, setMessages] = useState([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const box = useRef(null);
  const running = useRef(false);
  const mounted = useRef(false);

  useEffect(() => {
    mounted.current = true;
    async function run() {
      if (running.current) return;
      running.current = true;
      try {
        const next = await check();
        if (!mounted.current || !next.length) return;
        setMessages((current) => [...next, ...current].slice(0, 20));
        setUnread((current) => current + next.length);
        const text = next.length === 1 ? next[0] : `${next.length} novedades. Revisa la campanita.`;
        toast(text, "info");
        if (document.hidden && "Notification" in window && Notification.permission === "granted") {
          new Notification("ReservaYa", { body: text, icon: "/images/favicon.svg" });
        }
      } catch {
        // Sin red o sesión caída: se reintenta en el siguiente ciclo.
      } finally {
        running.current = false;
      }
    }
    run();
    const timer = window.setInterval(run, INTERVAL_MS);
    const onVisible = () => { if (!document.hidden) run(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      mounted.current = false;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [check, toast]);

  useEffect(() => {
    if (!open) return undefined;
    const onPointer = (event) => { if (!box.current?.contains(event.target)) setOpen(false); };
    const onKey = (event) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next) {
      setUnread(0);
      // Avisos del sistema cuando la pestaña no está visible; el permiso se pide con un clic del usuario.
      if ("Notification" in window && Notification.permission === "default") Notification.requestPermission();
    }
  }

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-haspopup="true"
        aria-label={unread ? `Notificaciones: ${unread} sin leer` : "Notificaciones"}
        className="foco-claro relative grid size-11 place-items-center rounded-full text-white transition hover:bg-white/15 active:scale-90"
      >
        <Bell size={21} aria-hidden="true" />
        {unread > 0 && (
          <span className="absolute right-1 top-1 grid h-5 min-w-5 place-items-center rounded-full bg-mostaza-500 px-1 text-[0.7rem] font-extrabold text-tinta ring-2 ring-rojo-600" aria-hidden="true">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-80 max-w-[calc(100vw-2rem)] animate-aviso overflow-hidden rounded-2xl border border-tinta/10 bg-papel text-tinta shadow-lift">
          <p className="border-b border-tinta/8 px-4 py-3 text-sm font-extrabold text-rojo-700">Notificaciones</p>
          {messages.length ? (
            <ul className="max-h-80 divide-y divide-tinta/8 overflow-y-auto">
              {messages.map((message, index) => (
                <li key={`${index}-${message}`} className="px-4 py-3 text-sm">{message}</li>
              ))}
            </ul>
          ) : (
            <p className="px-4 py-6 text-center text-sm text-piedra-700">Sin novedades por ahora.</p>
          )}
        </div>
      )}
    </div>
  );
}
