import clsx from "clsx";
import { STATUS } from "../../lib/api";

const TONES = {
  warn: "bg-mostaza-100 text-mostaza-900 [--punto:var(--color-mostaza-600)]",
  ok: "bg-exito-50 text-exito-800 [--punto:var(--color-exito-500)]",
  alert: "bg-rojo-50 text-rojo-800 [--punto:var(--color-rojo-600)]",
  off: "bg-piedra-100 text-piedra-700 [--punto:var(--color-piedra-400)]",
  brand: "bg-rojo-600 text-white [--punto:var(--color-mostaza-400)]",
};

export function Badge({ tone = "off", dot = true, className, children }) {
  return (
    <span className={clsx("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold whitespace-nowrap", TONES[tone], className)}>
      {dot && <span className="size-1.5 rounded-full bg-(--punto)" aria-hidden="true" />}
      {children}
    </span>
  );
}

/* Estado de una reserva (PENDING, CONFIRMED, CANCELLED, REJECTED, COMPLETED). */
export function StatusBadge({ status, className }) {
  const [label, tone] = STATUS[status] || [status, "off"];
  return <Badge tone={tone} className={className}>{label}</Badge>;
}
