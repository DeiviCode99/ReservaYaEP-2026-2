import { Link } from "react-router-dom";
import clsx from "clsx";

/* Marca: isotipo (logo-reservaya.svg) + nombre. `onDark` para fondos rojos u oscuros. */
export function Logo({ to = "/", onDark = false, className }) {
  return (
    <Link to={to} className={clsx("inline-flex items-center gap-2.5 rounded-lg", onDark && "foco-claro", className)} aria-label="ReservaYa, ir al inicio">
      <img
        src="/images/logo-reservaya.svg"
        alt=""
        width="36"
        height="36"
        className={clsx("size-9 rounded-full", onDark && "ring-2 ring-mostaza-500")}
      />
      <span className={clsx("text-xl font-extrabold tracking-tight", onDark ? "text-white" : "text-rojo-600")}>
        Reserva<span className={onDark ? "text-mostaza-400" : "text-naranja-700"}>Ya</span>
      </span>
    </Link>
  );
}
