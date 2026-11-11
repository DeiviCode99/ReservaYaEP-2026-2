import { Check } from "lucide-react";
import { Logo } from "../components/Logo";

const POINTS = [
  "Elige sede, día y hora según la disponibilidad real.",
  "Sigue el estado de tu reserva desde tu panel.",
  "Administra tus restaurantes y sedes.",
];

/* Acceso (login, registro, recuperar): panel de marca en rojo + formulario. */
export function AuthLayout({ title, lead, switcher, children }) {
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <aside className="foco-claro relative isolate overflow-hidden bg-rojo-700 text-white lg:min-h-dvh">
        <img
          src="/images/comida-colombiana-imagen-destacada.jpg"
          alt=""
          className="absolute inset-0 -z-20 size-full object-cover"
        />
        <div className="absolute inset-0 -z-10 bg-linear-to-b from-rojo-700/95 via-rojo-700/85 to-rojo-900/95" aria-hidden="true" />
        <div className="flex h-full flex-col px-5 py-5 sm:px-10 lg:px-12 lg:py-10">
          <Logo onDark />
          <div className="mt-6 lg:my-auto lg:py-10">
            <h1 className="max-w-md text-3xl font-extrabold sm:text-4xl lg:text-5xl">{title}</h1>
            <p className="mt-3 max-w-md text-base text-white/85 lg:text-lg">{lead}</p>
            <ul className="mt-8 hidden space-y-3 lg:block">
              {POINTS.map((point) => (
                <li key={point} className="flex items-start gap-3 text-[0.95rem] text-white/90">
                  <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-mostaza-500 text-tinta">
                    <Check size={13} strokeWidth={3} aria-hidden="true" />
                  </span>
                  {point}
                </li>
              ))}
            </ul>
          </div>
          <p className="hidden text-sm text-white/70 lg:block">Proyecto de Entornos de Programación · UIS 2026</p>
        </div>
      </aside>

      <main className="flex flex-col px-5 py-8 sm:px-10 lg:justify-center lg:px-16 lg:py-12">
        <div className="mx-auto w-full max-w-md">
          {switcher && <p className="mb-6 text-sm text-piedra-700 lg:text-right">{switcher}</p>}
          {children}
        </div>
      </main>
    </div>
  );
}

export function AuthCard({ title, lead, children }) {
  return (
    <section className="animate-surgir">
      <h2 className="text-2xl font-extrabold text-rojo-700 sm:text-3xl">{title}</h2>
      {lead && <p className="mt-2 text-piedra-700">{lead}</p>}
      <div className="mt-7">{children}</div>
    </section>
  );
}
