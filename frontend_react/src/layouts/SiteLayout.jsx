import { useEffect, useRef, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import clsx from "clsx";
import { LogOut, Menu, X } from "lucide-react";
import { Button, IconButton } from "../components/ui/Button";
import { Logo } from "../components/Logo";
import { Notifications } from "../components/Notifications";
import { getUser, logout } from "../lib/api";
import { checkAdmin, checkClient } from "../lib/notifications";

/* El menú cambia según el rol. */
function linksFor(user) {
  if (user?.role === "RESTAURANT_ADMIN") return [{ to: "/admin", label: "Mi panel" }, { to: "/sedes", label: "Sedes" }];
  if (user?.role === "CLIENT") return [{ to: "/sedes", label: "Sedes" }, { to: "/cliente", label: "Mis reservas" }];
  return [{ to: "/sedes", label: "Sedes" }, { to: "/registro?rol=restaurante", label: "Tengo un restaurante" }];
}

function Drawer({ open, onClose, links, user }) {
  const ref = useRef(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-label="Menú"
      onClose={onClose}
      onClick={(event) => { if (event.target === ref.current) onClose(); }}
      className="mb-0 ml-auto mr-0 mt-0 h-dvh max-h-none w-80 max-w-[86vw] bg-papel p-0 text-tinta shadow-lift open:animate-aviso"
    >
      {open && (
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between border-b border-tinta/8 px-4 py-3">
            <Logo />
            <IconButton icon={X} label="Cerrar menú" onClick={onClose} />
          </div>
          {user && (
            <p className="border-b border-tinta/8 bg-crema-50 px-5 py-3 text-sm text-piedra-700">
              Hola, <strong className="font-bold text-tinta">{user.name}</strong>
            </p>
          )}
          <nav aria-label="Menú móvil" className="flex-1 overflow-y-auto p-3">
            <ul className="space-y-1">
              {links.map((link) => (
                <li key={link.to}>
                  <NavLink
                    to={link.to}
                    onClick={onClose}
                    className={({ isActive }) => clsx(
                      "flex h-12 items-center rounded-xl px-4 text-base font-semibold transition-colors",
                      isActive && !link.to.includes("?") ? "bg-mostaza-100 text-tinta" : "text-tinta hover:bg-tinta/5",
                    )}
                  >
                    {link.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
          <div className="space-y-2.5 border-t border-tinta/8 p-4">
            {user ? (
              <Button variant="secondary" icon={LogOut} className="w-full" onClick={logout}>Cerrar sesión</Button>
            ) : (
              <>
                <Button to="/registro" className="w-full" onClick={onClose}>Crear cuenta</Button>
                <Button to="/login" variant="secondary" className="w-full" onClick={onClose}>Iniciar sesión</Button>
              </>
            )}
          </div>
        </div>
      )}
    </dialog>
  );
}

export function SiteLayout({ children }) {
  const user = getUser();
  const links = linksFor(user);
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  const check = user?.role === "CLIENT" ? checkClient : user?.role === "RESTAURANT_ADMIN" ? checkAdmin : null;

  useEffect(() => { setMenuOpen(false); }, [location.pathname]);

  return (
    <div className="flex min-h-dvh flex-col">
      <a href="#contenido" className="sr-only z-[70] rounded-full bg-mostaza-500 px-4 py-2 font-bold text-tinta focus:not-sr-only focus:fixed focus:left-3 focus:top-3">
        Saltar al contenido
      </a>
      <header className="sticky top-0 z-40 bg-rojo-600 text-white shadow-[0_2px_0_0_var(--color-rojo-800)]">
        <nav aria-label="Navegación principal" className="mx-auto flex h-16 max-w-6xl items-center gap-2 px-4 sm:px-6">
          <Logo onDark />
          <ul className="foco-claro ml-6 hidden items-center gap-1 md:flex">
            {links.map((link) => (
              <li key={link.to}>
                <NavLink
                  to={link.to}
                  className={({ isActive }) => clsx(
                    "relative inline-flex h-10 items-center rounded-full px-3.5 text-[0.95rem] font-semibold transition-colors hover:bg-white/12",
                    "after:absolute after:inset-x-3.5 after:bottom-1 after:h-0.5 after:rounded-full after:bg-mostaza-400 after:transition-transform after:duration-200",
                    isActive && !link.to.includes("?") ? "after:scale-x-100" : "after:scale-x-0",
                  )}
                >
                  {link.label}
                </NavLink>
              </li>
            ))}
          </ul>
          <div className="ml-auto flex items-center gap-1.5">
            {check && <Notifications check={check} />}
            <div className="foco-claro hidden items-center gap-2 md:flex">
              {user ? (
                <>
                  <span className="max-w-40 truncate px-2 text-sm font-medium text-white/90">{user.name}</span>
                  <Button variant="inverse" size="sm" icon={LogOut} onClick={logout}>Cerrar sesión</Button>
                </>
              ) : (
                <>
                  <Button to="/login" variant="inverse" size="sm">Iniciar sesión</Button>
                  <Button to="/registro" size="sm" className="shadow-[0_3px_0_0_var(--color-rojo-900)] hover:shadow-[0_4px_0_0_var(--color-rojo-900)]">Crear cuenta</Button>
                </>
              )}
            </div>
            <IconButton
              icon={Menu}
              label="Abrir menú"
              tone="dark"
              className="md:hidden"
              aria-expanded={menuOpen}
              aria-haspopup="dialog"
              onClick={() => setMenuOpen(true)}
            />
          </div>
        </nav>
      </header>

      <Drawer open={menuOpen} onClose={() => setMenuOpen(false)} links={links} user={user} />

      <main id="contenido" className="flex-1">{children}</main>

      <footer className="foco-claro mt-16 bg-tinta text-crema-100">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 sm:px-6 md:flex-row md:items-center md:justify-between">
          <div>
            <Logo onDark />
            <p className="mt-3 max-w-sm text-sm text-crema-100/75">
              Reserva mesa en los restaurantes del área metropolitana de Bucaramanga, sin llamadas ni filas.
            </p>
          </div>
          <p className="text-sm text-crema-100/75">
            Proyecto de Entornos de Programación · UIS 2026
          </p>
        </div>
      </footer>
    </div>
  );
}

/* Contenedor estándar de página. */
export function Page({ className, children }) {
  return <div className={clsx("mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10", className)}>{children}</div>;
}
