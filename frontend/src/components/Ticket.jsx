import clsx from "clsx";

/* La reserva como tiquete de comanda: cuerpo, línea perforada y talón con el
   código. `surface` es el color del fondo donde va puesto, para las muescas. */
export function Ticket({ children, stub, surface = "bg-crema-100", className, as: Tag = "article" }) {
  return (
    <Tag className={clsx("relative flex flex-col rounded-3xl border border-tinta/8 bg-papel shadow-card", className)}>
      <div className="flex-1 p-5">{children}</div>
      <div className="relative" aria-hidden="true">
        <div className="mx-5 border-t-2 border-dashed border-piedra-300" />
        <span className={clsx("absolute -left-px top-1/2 h-5 w-2.5 -translate-y-1/2 rounded-r-full border border-l-0 border-tinta/8", surface)} />
        <span className={clsx("absolute -right-px top-1/2 h-5 w-2.5 -translate-y-1/2 rounded-l-full border border-r-0 border-tinta/8", surface)} />
      </div>
      <div className="p-5 pt-4">{stub}</div>
    </Tag>
  );
}

export function TicketCode({ code }) {
  return (
    <p className="text-sm text-piedra-700">
      Código{" "}
      <strong className="ml-1 rounded-md bg-mostaza-100 px-2 py-1 font-mono text-[0.9rem] font-bold tracking-wider text-tinta">{code}</strong>
    </p>
  );
}
