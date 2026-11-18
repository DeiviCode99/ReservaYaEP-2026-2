import clsx from "clsx";

export function Card({ as: Tag = "div", className, children, ...props }) {
  return (
    <Tag className={clsx("rounded-3xl border border-tinta/8 bg-papel shadow-card", className)} {...props}>
      {children}
    </Tag>
  );
}

/* Cifra de resumen: número grande + etiqueta. */
export function Stat({ value, label, tone = "plain" }) {
  return (
    <div className={clsx(
      "rounded-2xl border px-4 py-3.5",
      tone === "plain" && "border-tinta/8 bg-papel",
      tone === "accent" && "border-mostaza-600/40 bg-mostaza-100",
    )}>
      <p className="text-2xl font-extrabold tabular-nums tracking-tight text-rojo-700 sm:text-3xl">{value}</p>
      <p className="mt-0.5 text-sm text-piedra-700">{label}</p>
    </div>
  );
}
