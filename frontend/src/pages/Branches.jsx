import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import clsx from "clsx";
import { ChevronLeft, ChevronRight, RotateCcw, Search, UtensilsCrossed } from "lucide-react";
import { Page, SiteLayout } from "../layouts/SiteLayout";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Chip } from "../components/ui/Select";
import { BranchCardSkeleton, Loading } from "../components/ui/Skeleton";
import { EmptyState } from "../components/ui/EmptyState";
import { BranchCard } from "../components/BranchCard";
import { apiFetch } from "../lib/api";
import { CITIES } from "../lib/format";

const PAGE_SIZE = 6;

function Pagination({ page, total, onChange }) {
  if (total <= 1) return null;
  const item = "grid size-11 place-items-center rounded-full text-sm font-bold tabular-nums transition duration-150 active:scale-90";
  return (
    <nav aria-label="Paginación de sedes" className="mt-8 flex items-center justify-center gap-1.5">
      <button type="button" className={clsx(item, "text-tinta hover:bg-tinta/8 disabled:pointer-events-none disabled:opacity-35")}
        disabled={page === 1} onClick={() => onChange(page - 1)} aria-label="Página anterior">
        <ChevronLeft size={20} aria-hidden="true" />
      </button>
      {Array.from({ length: total }, (_, index) => index + 1).map((number) => (
        <button
          key={number}
          type="button"
          onClick={() => onChange(number)}
          aria-label={`Ir a la página ${number}`}
          aria-current={number === page ? "page" : undefined}
          className={clsx(item, number === page
            ? "bg-mostaza-500 text-tinta shadow-[0_2px_0_0_var(--color-mostaza-700)]"
            : "bg-papel text-tinta ring-1 ring-inset ring-piedra-300 hover:bg-mostaza-50")}
        >
          {number}
        </button>
      ))}
      <button type="button" className={clsx(item, "text-tinta hover:bg-tinta/8 disabled:pointer-events-none disabled:opacity-35")}
        disabled={page === total} onClick={() => onChange(page + 1)} aria-label="Página siguiente">
        <ChevronRight size={20} aria-hidden="true" />
      </button>
    </nav>
  );
}

export default function Branches() {
  const [params, setParams] = useSearchParams();
  const name = params.get("name") || "";
  const city = params.get("city") || "";
  const cuisine = params.get("cuisine") || "";
  const page = Math.max(1, Number(params.get("page")) || 1);

  const [draft, setDraft] = useState({ name, cuisine });
  const [state, setState] = useState({ status: "loading", items: [], message: "" });
  const [cuisines, setCuisines] = useState([]);
  const [attempt, setAttempt] = useState(0);
  const request = useRef(0);
  const resultsRef = useRef(null);

  useEffect(() => { setDraft({ name, cuisine }); }, [name, cuisine]);

  // Tipos de cocina para las fichas: salen de las sedes publicadas.
  useEffect(() => {
    let active = true;
    apiFetch("/api/restaurants/branches")
      .then((data) => {
        if (!active || !Array.isArray(data)) return;
        setCuisines([...new Set(data.map((branch) => branch.cuisineType).filter(Boolean))].sort((a, b) => a.localeCompare(b, "es")));
      })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const current = ++request.current;
    setState((previous) => ({ ...previous, status: "loading" }));
    // Solo se envían los campos llenos; un filtro ausente no filtra.
    const query = new URLSearchParams(Object.entries({ name, city, cuisine }).filter(([, value]) => value));
    apiFetch(`/api/restaurants/branches?${query}`)
      .then((data) => {
        if (current === request.current) setState({ status: "ready", items: Array.isArray(data) ? data : [], message: "" });
      })
      .catch((error) => {
        if (current === request.current) setState({ status: "error", items: [], message: error.message });
      });
  }, [name, city, cuisine, attempt]);

  function setFilters(changes) {
    const next = new URLSearchParams(params);
    Object.entries(changes).forEach(([key, value]) => { if (value) next.set(key, value); else next.delete(key); });
    next.delete("page");
    setParams(next);
  }
  function setPage(number) {
    const next = new URLSearchParams(params);
    if (number > 1) next.set("page", String(number)); else next.delete("page");
    setParams(next);
    resultsRef.current?.scrollIntoView({ block: "start" });
  }

  const totalPages = Math.max(1, Math.ceil(state.items.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const shown = useMemo(
    () => state.items.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [state.items, currentPage],
  );
  const hasFilters = Boolean(name || city || cuisine);
  const cuisineChips = cuisine && !cuisines.includes(cuisine) ? [cuisine, ...cuisines] : cuisines;

  return (
    <SiteLayout>
      <div className="border-b border-tinta/8 bg-crema-50">
        <Page className="pb-6 sm:pb-8">
          <h1 className="text-3xl font-extrabold text-rojo-700 sm:text-4xl">Encuentra tu sede favorita</h1>
          <p className="mt-2 max-w-2xl text-piedra-700">Sedes en Bucaramanga, Floridablanca, Girón y Piedecuesta. Filtra por ciudad o tipo de cocina y elige dónde quieres sentarte.</p>

          <form
            role="search"
            aria-label="Buscar sedes"
            onSubmit={(event) => { event.preventDefault(); setFilters({ name: draft.name.trim(), cuisine: draft.cuisine.trim() }); }}
            className="mt-6 grid gap-3 sm:grid-cols-[1fr_1fr_auto]"
          >
            <Input type="search" icon={Search} aria-label="Nombre del restaurante" placeholder="Restaurante, ej. Doña Marta"
              value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} />
            <Input type="search" icon={UtensilsCrossed} aria-label="Tipo de cocina" placeholder="Cocina, ej. Santandereana"
              value={draft.cuisine} onChange={(event) => setDraft({ ...draft, cuisine: event.target.value })} />
            <Button type="submit" icon={Search}>Buscar</Button>
          </form>

          <div className="mt-5 space-y-3">
            <div className="flex items-center gap-3">
              <span id="filtro-ciudad" className="w-16 shrink-0 text-xs font-bold text-piedra-700">Ciudad</span>
              <div role="group" aria-labelledby="filtro-ciudad" className="-my-1 flex gap-2 overflow-x-auto py-1 pr-1">
                <Chip selected={!city} aria-pressed={!city} onClick={() => setFilters({ city: "" })}>Todas</Chip>
                {CITIES.map((option) => (
                  <Chip key={option} selected={city === option} aria-pressed={city === option} onClick={() => setFilters({ city: city === option ? "" : option })}>
                    {option}
                  </Chip>
                ))}
              </div>
            </div>
            {cuisineChips.length > 0 && (
              <div className="flex items-center gap-3">
                <span id="filtro-cocina" className="w-16 shrink-0 text-xs font-bold text-piedra-700">Cocina</span>
                <div role="group" aria-labelledby="filtro-cocina" className="-my-1 flex gap-2 overflow-x-auto py-1 pr-1">
                  <Chip selected={!cuisine} aria-pressed={!cuisine} onClick={() => setFilters({ cuisine: "" })}>Todas</Chip>
                  {cuisineChips.map((option) => (
                    <Chip key={option} selected={cuisine === option} aria-pressed={cuisine === option} onClick={() => setFilters({ cuisine: cuisine === option ? "" : option })}>
                      {option}
                    </Chip>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Page>
      </div>

      <Page>
        <div ref={resultsRef} className="mb-5 flex scroll-mt-24 flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-extrabold text-tinta">Sedes disponibles</h2>
          <div className="flex items-center gap-3">
            <p className="text-sm text-piedra-700" role="status">
              {state.status === "ready" && (
                <><strong className="font-bold tabular-nums text-tinta">{state.items.length}</strong> {state.items.length === 1 ? "sede encontrada" : "sedes encontradas"}</>
              )}
            </p>
            {hasFilters && (
              <Button size="sm" variant="ghost" icon={RotateCcw} onClick={() => setParams({})}>Quitar filtros</Button>
            )}
          </div>
        </div>

        {state.status === "loading" && (
          <Loading label="Cargando sedes…" className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: PAGE_SIZE }, (_, index) => <BranchCardSkeleton key={index} />)}
          </Loading>
        )}
        {state.status === "error" && (
          <EmptyState art="restaurantes" title="No se pudieron cargar las sedes"
            action={<Button variant="secondary" icon={RotateCcw} onClick={() => setAttempt((value) => value + 1)}>Reintentar</Button>}>
            {state.message}
          </EmptyState>
        )}
        {state.status === "ready" && state.items.length === 0 && (
          <EmptyState art="restaurantes" title="No encontramos sedes con esos filtros"
            action={hasFilters && <Button variant="secondary" onClick={() => setParams({})}>Ver todas las sedes</Button>}>
            Prueba con otra ciudad u otro tipo de cocina.
          </EmptyState>
        )}
        {state.status === "ready" && state.items.length > 0 && (
          <>
            <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {shown.map((branch, index) => (
                <li key={branch.id}>
                  <BranchCard branch={branch} eager={index < 3} />
                </li>
              ))}
            </ul>
            <Pagination page={currentPage} total={totalPages} onChange={setPage} />
          </>
        )}
      </Page>
    </SiteLayout>
  );
}
