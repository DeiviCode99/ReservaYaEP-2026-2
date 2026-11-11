import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, CalendarCheck, MapPin, Search, Store, UtensilsCrossed } from "lucide-react";
import { SiteLayout } from "../layouts/SiteLayout";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Select } from "../components/ui/Select";
import { BranchCardSkeleton, Loading } from "../components/ui/Skeleton";
import { EmptyState } from "../components/ui/EmptyState";
import { Carousel } from "../components/Carousel";
import { BranchCard } from "../components/BranchCard";
import { apiFetch, getUser } from "../lib/api";
import { CITIES, homeFor } from "../lib/format";
import { HERO_SLIDES } from "../lib/images";

const STEPS = [
  { icon: Search, title: "Busca tu sede", text: "Filtra por ciudad, restaurante o tipo de cocina." },
  { icon: CalendarCheck, title: "Elige día y hora", text: "Solo ves las franjas que todavía tienen cupo." },
  { icon: UtensilsCrossed, title: "Llega directo a la mesa", text: "El restaurante confirma y tú llevas tu código." },
];

const RAIL_SLIDE = "basis-[82%] sm:basis-1/2 lg:basis-1/3";

function HeroSearch() {
  const navigate = useNavigate();
  const [query, setQuery] = useState({ name: "", city: "", cuisine: "" });
  const update = (key) => (event) => setQuery((current) => ({ ...current, [key]: event.target.value }));

  function submit(event) {
    event.preventDefault();
    const params = new URLSearchParams(Object.entries(query).map(([key, value]) => [key, value.trim()]).filter(([, value]) => value));
    navigate(`/sedes${params.size ? `?${params}` : ""}`);
  }

  return (
    <form
      onSubmit={submit}
      role="search"
      aria-label="Buscar sedes"
      className="grid gap-3 rounded-3xl bg-papel p-4 text-tinta shadow-lift sm:grid-cols-2 sm:p-5 lg:grid-cols-[1.3fr_1fr_1fr_auto] lg:items-end"
    >
      <label className="block">
        <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-piedra-700">Restaurante</span>
        <Input type="search" icon={Search} placeholder="Ej. Doña Marta" value={query.name} onChange={update("name")} />
      </label>
      <label className="block">
        <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-piedra-700">Ciudad</span>
        <Select value={query.city} onChange={update("city")}>
          <option value="">Toda el área metropolitana</option>
          {CITIES.map((city) => <option key={city}>{city}</option>)}
        </Select>
      </label>
      <label className="block">
        <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-piedra-700">Tipo de cocina</span>
        <Input type="search" icon={UtensilsCrossed} placeholder="Ej. Santandereana" value={query.cuisine} onChange={update("cuisine")} />
      </label>
      <Button type="submit" size="md" icon={Search} className="sm:col-span-2 lg:col-span-1">Buscar mesa</Button>
    </form>
  );
}

function FeaturedBranches() {
  const [state, setState] = useState({ status: "loading", items: [] });

  useEffect(() => {
    let active = true;
    apiFetch("/api/restaurants/branches")
      .then((data) => { if (active) setState({ status: "ready", items: Array.isArray(data) ? data.slice(0, 9) : [] }); })
      .catch(() => { if (active) setState({ status: "error", items: [] }); });
    return () => { active = false; };
  }, []);

  const header = (
    <>
      <h2 className="text-2xl font-extrabold text-rojo-700 sm:text-3xl">Reserva esta noche</h2>
      <p className="mt-1.5 text-piedra-700">Sedes del área metropolitana que están recibiendo reservas.</p>
    </>
  );

  if (state.status === "loading") {
    return (
      <div>
        <div className="mb-5">{header}</div>
        <Loading label="Cargando sedes…" className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <BranchCardSkeleton />
          <div className="hidden sm:block"><BranchCardSkeleton /></div>
          <div className="hidden lg:block"><BranchCardSkeleton /></div>
        </Loading>
      </div>
    );
  }
  if (!state.items.length) {
    return (
      <div>
        <div className="mb-5">{header}</div>
        <EmptyState art="restaurantes" title={state.status === "error" ? "No pudimos cargar las sedes" : "Aún no hay sedes publicadas"}>
          {state.status === "error"
            ? "Revisa tu conexión y vuelve a intentarlo en un momento."
            : "Cuando los restaurantes registren sus sedes, aparecerán aquí."}
        </EmptyState>
      </div>
    );
  }
  return (
    <>
      <Carousel label="Sedes destacadas" header={header} slideClassName={RAIL_SLIDE} viewportClassName="-m-3 p-3">
        {state.items.map((branch) => <BranchCard key={branch.id} branch={branch} />)}
      </Carousel>
      <p className="mt-6 text-center">
        <Button to="/sedes" variant="secondary" iconRight={ArrowRight}>Ver todas las sedes</Button>
      </p>
    </>
  );
}

export default function Landing() {
  const user = getUser();
  return (
    <SiteLayout>
      <section className="relative isolate bg-tinta text-white">
        <Carousel
          label="Fotos de restaurantes y platos"
          variant="hero"
          autoplay
          loop
          className="absolute inset-0 -z-10"
          controlsClassName="bottom-24 sm:bottom-20"
          overlay={(
            <>
              <div className="pointer-events-none absolute inset-0 bg-linear-to-r from-tinta/90 via-tinta/65 to-tinta/25" aria-hidden="true" />
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-48 bg-linear-to-t from-tinta/85 to-transparent" aria-hidden="true" />
            </>
          )}
        >
          {HERO_SLIDES.map((slide, index) => (
            <img
              key={slide.src}
              src={slide.src}
              srcSet={slide.srcSet}
              sizes="100vw"
              alt={slide.alt}
              loading={index === 0 ? "eager" : "lazy"}
              decoding="async"
              className="size-full object-cover"
            />
          ))}
        </Carousel>

        <div className="pointer-events-none mx-auto max-w-6xl px-4 pb-48 pt-12 sm:px-6 sm:pb-44 sm:pt-20 lg:pb-44 lg:pt-28">
          <div className="pointer-events-auto max-w-2xl animate-surgir">
            <p className="inline-flex items-center gap-2 rounded-full bg-mostaza-500 px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider text-tinta">
              <MapPin size={14} aria-hidden="true" /> Área metropolitana de Bucaramanga
            </p>
            <h1 className="mt-5 text-4xl font-extrabold sm:text-5xl lg:text-6xl">
              Tu mesa lista,<br />sin llamadas <span className="text-mostaza-400">ni filas.</span>
            </h1>
            <p className="mt-4 max-w-xl text-lg text-white/90">
              Elige la sede, el día y la hora con cupo real. El restaurante confirma y tú llegas directo a sentarte.
            </p>
          </div>
        </div>
      </section>

      <div className="relative z-10 mx-auto -mt-24 max-w-6xl px-4 sm:-mt-20 sm:px-6">
        <HeroSearch />
      </div>

      <section className="mx-auto max-w-6xl px-4 pt-14 sm:px-6 sm:pt-16">
        <FeaturedBranches />
      </section>

      <section className="mx-auto max-w-6xl px-4 pt-16 sm:px-6" aria-labelledby="ciudades">
        <h2 id="ciudades" className="text-2xl font-extrabold text-rojo-700 sm:text-3xl">Explora por ciudad</h2>
        <ul className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {CITIES.map((city) => (
            <li key={city}>
              <Link
                to={`/sedes?city=${encodeURIComponent(city)}`}
                className="group flex h-full items-center justify-between gap-3 rounded-2xl border border-tinta/8 bg-papel px-4 py-4 font-bold text-tinta shadow-card transition duration-200 hover:-translate-y-0.5 hover:border-mostaza-600 hover:bg-mostaza-100"
              >
                <span className="flex items-center gap-2.5">
                  <MapPin size={18} className="text-rojo-600" aria-hidden="true" /> {city}
                </span>
                <ArrowRight size={18} className="text-piedra-500 transition-transform duration-200 group-hover:translate-x-1 group-hover:text-tinta" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="mx-auto max-w-6xl px-4 pt-16 sm:px-6" aria-labelledby="como-funciona">
        <h2 id="como-funciona" className="text-2xl font-extrabold text-rojo-700 sm:text-3xl">Así funciona</h2>
        <ol className="mt-6 grid gap-4 md:grid-cols-3">
          {STEPS.map((step, index) => (
            <li key={step.title} className="relative rounded-3xl border border-tinta/8 bg-papel p-6 shadow-card">
              <span className="absolute right-5 top-4 text-5xl font-extrabold tabular-nums text-crema-200" aria-hidden="true">{index + 1}</span>
              <span className="grid size-12 place-items-center rounded-2xl bg-rojo-600 text-white">
                <step.icon size={22} aria-hidden="true" />
              </span>
              <h3 className="mt-4 text-lg font-extrabold text-tinta">{step.title}</h3>
              <p className="mt-1.5 text-sm text-piedra-700">{step.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="mx-auto max-w-6xl px-4 pt-16 sm:px-6">
        <div className="foco-claro relative isolate overflow-hidden rounded-3xl bg-rojo-600 px-6 py-10 text-white sm:px-10 sm:py-12">
          <Store size={220} strokeWidth={1} className="absolute -bottom-10 -right-6 -z-10 text-rojo-500" aria-hidden="true" />
          <h2 className="max-w-xl text-2xl font-extrabold sm:text-3xl">¿Tienes un restaurante?</h2>
          <p className="mt-3 max-w-xl text-white/90">
            Registra tus sedes, define horarios y aforo, y responde las reservas desde un solo panel.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            {user
              ? <Button to={homeFor(user)} size="lg" iconRight={ArrowRight} className="shadow-[0_3px_0_0_var(--color-rojo-900)]">Ir a mi panel</Button>
              : <Button to="/registro?rol=restaurante" size="lg" iconRight={ArrowRight} className="shadow-[0_3px_0_0_var(--color-rojo-900)]">Registrar mi restaurante</Button>}
          </div>
        </div>
      </section>
    </SiteLayout>
  );
}
