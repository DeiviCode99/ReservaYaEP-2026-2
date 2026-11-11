import { Link } from "react-router-dom";
import { ArrowUpRight, Clock, MapPin } from "lucide-react";
import { SmartImage } from "./SmartImage";
import { coverFor } from "../lib/images";
import { depositFor, formatCurrency, todayLabel } from "../lib/format";

/* Tarjeta de sede: foto grande, cocina, restaurante, ubicación, horario de
   hoy y abono mínimo. Toda la tarjeta es un único enlace a la ficha. */
export function BranchCard({ branch, eager = false }) {
  const cover = coverFor(branch);
  const today = todayLabel(branch);
  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-3xl border border-tinta/8 bg-papel shadow-card transition duration-300 hover:-translate-y-1 hover:shadow-lift focus-within:shadow-lift">
      <div className="relative">
        <SmartImage
          src={cover.thumb}
          srcSet={cover.srcSet}
          sizes="(min-width: 1024px) 360px, (min-width: 640px) 50vw, 100vw"
          alt=""
          eager={eager}
          className="aspect-[4/3]"
          imgClassName="transition-transform duration-700 group-hover:scale-105"
        />
        <span className="absolute left-3 top-3 rounded-full bg-mostaza-500 px-3 py-1 text-xs font-bold uppercase tracking-wide text-tinta shadow-card">
          {branch.cuisineType}
        </span>
      </div>
      <div className="flex flex-1 flex-col p-4">
        <h3 className="text-lg font-extrabold text-tinta">
          <Link to={`/sedes/${branch.id}`} className="outline-none after:absolute after:inset-0 after:rounded-3xl focus-visible:after:outline-3 focus-visible:after:outline-naranja-600">
            {branch.restaurantName}
          </Link>
        </h3>
        <p className="text-sm font-semibold text-rojo-700">{branch.name}</p>
        <p className="mt-2 flex items-start gap-1.5 text-sm text-piedra-700">
          <MapPin size={16} className="mt-0.5 shrink-0 text-piedra-500" aria-hidden="true" />
          <span>{branch.address}, {branch.city}</span>
        </p>
        {today && (
          <p className="mt-1 flex items-center gap-1.5 text-sm text-piedra-700">
            <Clock size={16} className="shrink-0 text-piedra-500" aria-hidden="true" />
            <span className="tabular-nums">{today}</span>
          </p>
        )}
        <div className="mt-auto flex items-center justify-between gap-3 pt-4">
          <p className="text-sm text-piedra-700">
            Abono desde <strong className="font-bold tabular-nums text-tinta">{formatCurrency(depositFor(1))}</strong>
          </p>
          <span className="inline-flex items-center gap-1 text-sm font-bold text-naranja-700 transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden="true">
            Reservar <ArrowUpRight size={16} />
          </span>
        </div>
      </div>
    </article>
  );
}
