import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import clsx from "clsx";
import { ChevronLeft, Clock, MapPin, Phone, Users, Wallet } from "lucide-react";
import { Page, SiteLayout } from "../layouts/SiteLayout";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { Card } from "../components/ui/Card";
import { Modal } from "../components/ui/Modal";
import { Loading, Skeleton } from "../components/ui/Skeleton";
import { EmptyState } from "../components/ui/EmptyState";
import { Gallery } from "../components/Gallery";
import { BookingPanel } from "../components/BookingPanel";
import { apiFetch } from "../lib/api";
import { DAYS, depositFor, formatCurrency, hhmm, todaySchedule } from "../lib/format";
import { photosFor } from "../lib/images";

function Fact({ icon: Icon, label, children }) {
  return (
    <li className="flex items-start gap-3">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-mostaza-100 text-mostaza-900">
        <Icon size={18} aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className="text-xs font-bold text-piedra-600">{label}</p>
        <div className="font-semibold text-tinta">{children}</div>
      </div>
    </li>
  );
}

function Schedules({ branch }) {
  const today = new Date().getDay() || 7;
  const byDay = new Map((branch.schedules || []).map((schedule) => [schedule.dayOfWeek, schedule]));
  if (!byDay.size) return <p className="text-sm text-piedra-700">La sede aún no publica sus horarios.</p>;
  return (
    <ul className="divide-y divide-tinta/8">
      {DAYS.map((day, index) => {
        const schedule = byDay.get(index + 1);
        const closed = !schedule || schedule.isClosed;
        const isToday = today === index + 1;
        return (
          <li key={day} className={clsx("flex items-center justify-between gap-4 px-3 py-2.5 text-sm", isToday && "rounded-xl bg-mostaza-100 font-bold")}>
            <span className="flex items-center gap-2">
              {day}
              {isToday && <span className="rounded-full bg-tinta px-2 py-0.5 text-[0.65rem] font-bold text-mostaza-300">Hoy</span>}
            </span>
            <span className={clsx("tabular-nums", closed ? "text-piedra-600" : "text-tinta")}>
              {closed ? "Cerrado" : `${hhmm(schedule.openTime)} – ${hhmm(schedule.closeTime)}`}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function DetailSkeleton() {
  return (
    <Loading label="Cargando la sede…">
      <Skeleton className="aspect-[4/3] rounded-3xl md:aspect-[5/2]" />
      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_24rem]">
        <div className="space-y-4">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-10 w-2/3" />
          <Skeleton className="h-5 w-1/2" />
          <Skeleton className="h-40 w-full rounded-3xl" />
        </div>
        <Skeleton className="h-96 rounded-3xl" />
      </div>
    </Loading>
  );
}

/* true desde 1024 px: ahí el panel de reserva va fijo al lado; por debajo, en hoja inferior. */
function useDesktop() {
  const [matches, setMatches] = useState(() => window.matchMedia("(min-width: 1024px)").matches);
  useEffect(() => {
    const query = window.matchMedia("(min-width: 1024px)");
    const onChange = () => setMatches(query.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);
  return matches;
}

export default function BranchDetail() {
  const { id } = useParams();
  const desktop = useDesktop();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [state, setState] = useState({ status: "loading", branch: null, message: "" });

  useEffect(() => {
    let active = true;
    setState({ status: "loading", branch: null, message: "" });
    apiFetch(`/api/restaurants/branches/${id}`)
      .then((branch) => { if (active) setState({ status: "ready", branch, message: "" }); })
      .catch((error) => { if (active) setState({ status: "error", branch: null, message: error.message }); });
    return () => { active = false; };
  }, [id]);

  useEffect(() => {
    if (state.branch) document.title = `${state.branch.restaurantName} · ${state.branch.name} | ReservaYa`;
    return () => { document.title = "ReservaYa"; };
  }, [state.branch]);

  const { branch } = state;
  const today = branch && todaySchedule(branch);

  return (
    <SiteLayout>
      <Page className="pt-5 sm:pt-6">
        <Link to="/sedes" className="mb-4 inline-flex h-10 items-center gap-1 rounded-full pr-3 text-sm font-semibold text-piedra-700 hover:text-rojo-700">
          <ChevronLeft size={18} aria-hidden="true" /> Todas las sedes
        </Link>

        {state.status === "loading" && <DetailSkeleton />}
        {state.status === "error" && (
          <EmptyState art="restaurantes" title="No encontramos esta sede" action={<Button to="/sedes" variant="secondary">Ver todas las sedes</Button>}>
            {state.message}
          </EmptyState>
        )}

        {branch && (
          <>
            <Gallery photos={photosFor(branch)} label={`Fotos de ${branch.restaurantName}`} />
            <p className="mt-2 text-xs text-piedra-600">Fotos de referencia.</p>

            <div className="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_24rem] lg:items-start">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="warn" dot={false}>{branch.cuisineType}</Badge>
                  {branch.active === false && <Badge tone="off">Sede inactiva</Badge>}
                  {today && (today.isClosed
                    ? <Badge tone="alert">Cerrado hoy</Badge>
                    : <Badge tone="ok">Abre hoy {hhmm(today.openTime)} – {hhmm(today.closeTime)}</Badge>)}
                </div>
                <h1 className="mt-3 text-3xl font-extrabold text-rojo-700 sm:text-4xl lg:text-5xl">{branch.restaurantName}</h1>
                <p className="mt-1.5 text-lg font-semibold text-tinta">{branch.name}</p>

                <ul className="mt-6 grid gap-4 sm:grid-cols-2">
                  <Fact icon={MapPin} label="Dirección">{branch.address}, {branch.city}</Fact>
                  {branch.phone && (
                    <Fact icon={Phone} label="Teléfono">
                      <a href={`tel:${branch.phone}`} className="underline decoration-mostaza-600 decoration-2 underline-offset-4 hover:text-rojo-700">{branch.phone}</a>
                    </Fact>
                  )}
                  <Fact icon={Users} label="Aforo">{branch.capacity} personas por franja</Fact>
                  <Fact icon={Wallet} label="Abono">
                    {formatCurrency(depositFor(1))} hasta 3 personas, {formatCurrency(depositFor(4))} desde 4
                  </Fact>
                </ul>

                <section className="mt-8" aria-labelledby="horarios">
                  <h2 id="horarios" className="flex items-center gap-2 text-xl font-extrabold text-tinta">
                    <Clock size={20} className="text-rojo-600" aria-hidden="true" /> Horarios de atención
                  </h2>
                  <Card className="mt-3 p-2">
                    <Schedules branch={branch} />
                  </Card>
                </section>
              </div>

              {desktop && (
                <Card as="aside" aria-labelledby="reservar-titulo" className="sticky top-24 min-w-0 p-5">
                  <h2 id="reservar-titulo" className="text-xl font-extrabold text-rojo-700">Reserva tu mesa</h2>
                  <p className="mb-5 mt-1 text-sm text-piedra-700">{branch.restaurantName} · {branch.name}</p>
                  {branch.active === false
                    ? <p className="rounded-2xl bg-crema-100 px-4 py-3 text-sm text-piedra-800">Esta sede no está recibiendo reservas por ahora.</p>
                    : <BookingPanel key={branch.id} branch={branch} />}
                </Card>
              )}
            </div>

            {!desktop && (
              <>
                <div className="fixed inset-x-0 bottom-0 z-30 border-t border-tinta/10 bg-papel/95 p-3 backdrop-blur">
                  {branch.active === false
                    ? <p className="py-2 text-center text-sm font-semibold text-piedra-700">Esta sede no está recibiendo reservas por ahora.</p>
                    : <Button size="lg" className="w-full" aria-haspopup="dialog" onClick={() => setSheetOpen(true)}>Reservar mesa</Button>}
                </div>
                <Modal
                  open={sheetOpen}
                  onClose={() => setSheetOpen(false)}
                  title="Reserva tu mesa"
                  description={branch.restaurantName + " · " + branch.name}
                >
                  {sheetOpen && <BookingPanel key={branch.id} branch={branch} />}
                </Modal>
              </>
            )}
            <div className="h-20 lg:hidden" aria-hidden="true" />
          </>
        )}
      </Page>
    </SiteLayout>
  );
}
