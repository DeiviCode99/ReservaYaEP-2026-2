import clsx from "clsx";

const ART = {
  reservas: "/images/vacio-reservas.svg",
  restaurantes: "/images/vacio-restaurantes.svg",
};

export function EmptyState({ art = "reservas", title, children, action, className }) {
  return (
    <div className={clsx("flex flex-col items-center rounded-3xl border-[1.5px] border-dashed border-piedra-300 bg-crema-50 px-6 py-10 text-center", className)}>
      <img src={ART[art]} alt="" width="96" height="96" className="size-24" loading="lazy" />
      {title && <h3 className="mt-4 text-lg font-bold text-tinta">{title}</h3>}
      {children && <p className="mt-1.5 max-w-sm text-sm text-piedra-700">{children}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
