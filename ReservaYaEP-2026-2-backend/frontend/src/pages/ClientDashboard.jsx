import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import clsx from "clsx";
import { Search } from "lucide-react";
import { Page, SiteLayout } from "../layouts/SiteLayout";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Stat } from "../components/ui/Card";
import { Modal } from "../components/ui/Modal";
import { Loading, Skeleton, TicketSkeleton } from "../components/ui/Skeleton";
import { EmptyState } from "../components/ui/EmptyState";
import { useToast } from "../components/ui/Toast";
import { ReservationCard } from "../components/ReservationCard";
import { BookingPanel } from "../components/BookingPanel";
import { apiFetch, formatDate, getUser } from "../lib/api";
import { hhmm, reservationIsActive } from "../lib/format";
import { branchLabel, CHANGES_EVENT } from "../lib/notifications";

const byDate = (a, b) => `${a.reservationDate}${a.reservationTime}`.localeCompare(`${b.reservationDate}${b.reservationTime}`);

export default function ClientDashboard() {
  const user = getUser();
  const toast = useToast();
  const navigate = useNavigate();
  const [state, setState] = useState({ status: "loading", items: [], message: "" });
  const [tab, setTab] = useState("activas");
  const [search, setSearch] = useState("");
  const [cancelling, setCancelling] = useState(null);
  const [cancelBusy, setCancelBusy] = useState(false);
  const [editing, setEditing] = useState(null); // { reservation, branch }

  const load = useCallback(async () => {
    try {
      const data = await apiFetch("/api/reservations");
      if (!Array.isArray(data)) throw new Error("El servidor devolvió un formato de reservas inválido.");
      const named = await Promise.all(data.map(async (reservation) => ({
        ...reservation,
        branchName: await branchLabel(reservation.branchId),
      })));
      setState({ status: "ready", items: named, message: "" });
    } catch (error) {
      setState({ status: "error", items: [], message: error.message });
    }
  }, []);

  useEffect(() => {
    load();
    // La campanita avisa cuando el restaurante responde: se refresca la lista.
    window.addEventListener(CHANGES_EVENT, load);
    return () => window.removeEventListener(CHANGES_EVENT, load);
  }, [load]);

  async function startEdit(reservation) {
    try {
      const branch = await apiFetch(`/api/restaurants/branches/${reservation.branchId}`);
      setEditing({ reservation, branch });
    } catch (error) {
      toast(error.message, "error");
    }
  }

  async function confirmCancel() {
    setCancelBusy(true);
    try {
      await apiFetch(`/api/reservations/${cancelling.id}`, {
        method: "PATCH",
        body: JSON.stringify({ cancellationReason: "Cancelada por el cliente" }),
      });
      await load();
      toast(`La reserva #${cancelling.id} fue cancelada correctamente.`, "success");
      setCancelling(null);
    } catch (error) {
      toast(error.message, "error");
    } finally {
      setCancelBusy(false);
    }
  }

  const active = state.items.filter(reservationIsActive).sort(byDate);
  const history = state.items.filter((reservation) => !reservationIsActive(reservation)).sort((a, b) => byDate(b, a));
  const upcoming = active[0];
  const shown = tab === "activas" ? active : history;
  const tabs = [
    { id: "activas", label: "Activas", count: active.length },
    { id: "historial", label: "Historial", count: history.length },
  ];

  return (
    <SiteLayout>
      <Page>
        <header className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="font-semibold text-piedra-700">Hola, {user.name}</p>
            <h1 className="mt-1 text-3xl font-extrabold text-rojo-700 sm:text-4xl">Mis reservas</h1>
            <p className="mt-2 max-w-xl text-piedra-700">Revisa lo que tienes reservado, cancela si cambian tus planes y consulta tu historial.</p>
          </div>
          <form
            role="search"
            aria-label="Buscar restaurante para reservar"
            onSubmit={(event) => { event.preventDefault(); navigate(`/sedes${search.trim() ? `?name=${encodeURIComponent(search.trim())}` : ""}`); }}
            className="flex w-full gap-2 lg:w-auto"
          >
            <div className="min-w-0 flex-1 lg:w-64">
              <Input type="search" icon={Search} aria-label="Nombre del restaurante" placeholder="Busca un restaurante" value={search} onChange={(event) => setSearch(event.target.value)} />
            </div>
            <Button type="submit">Reservar mesa</Button>
          </form>
        </header>

        <section aria-label="Resumen de tus reservas" className="mt-7 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {state.status === "loading" ? (
            <Loading label="Cargando resumen…" className="contents">
              {[0, 1, 2].map((index) => <Skeleton key={index} className="h-[5.25rem] rounded-2xl" />)}
            </Loading>
          ) : (
            <>
              <Stat value={active.length} label="Reservas activas" />
              <Stat
                tone={upcoming ? "accent" : "plain"}
                value={upcoming ? formatDate(upcoming.reservationDate) : "—"}
                label={upcoming ? `Tu próxima reserva, a las ${hhmm(upcoming.reservationTime)}` : "Tu próxima reserva"}
              />
              <Stat value={history.length} label="Reservas en el historial" />
            </>
          )}
        </section>

        <div role="tablist" aria-label="Tus reservas" className="mt-8 inline-flex rounded-full border border-tinta/10 bg-papel p-1">
          {tabs.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              id={`tab-${item.id}`}
              aria-selected={tab === item.id}
              aria-controls="panel-reservas"
              onClick={() => setTab(item.id)}
              className={clsx(
                "inline-flex h-10 items-center gap-2 rounded-full px-5 text-sm font-bold transition duration-150",
                tab === item.id ? "bg-rojo-600 text-white" : "text-piedra-700 hover:bg-tinta/5 hover:text-tinta",
              )}
            >
              {item.label}
              <span className={clsx("rounded-full px-2 py-0.5 text-xs tabular-nums", tab === item.id ? "bg-white/20" : "bg-tinta/8")}>{item.count}</span>
            </button>
          ))}
        </div>

        <section id="panel-reservas" role="tabpanel" aria-labelledby={`tab-${tab}`} className="mt-5">
          {state.status === "loading" && (
            <Loading label="Cargando tus reservas…" className="grid gap-5 md:grid-cols-2">
              <TicketSkeleton /><TicketSkeleton />
            </Loading>
          )}
          {state.status === "error" && (
            <EmptyState art="reservas" title="No pudimos cargar tus reservas" action={<Button variant="secondary" onClick={load}>Reintentar</Button>}>
              {state.message}
            </EmptyState>
          )}
          {state.status === "ready" && shown.length === 0 && (tab === "activas" ? (
            <EmptyState art="reservas" title="No tienes reservas activas" action={<Button to="/sedes">Buscar una sede</Button>}>
              Busca un restaurante y aparta tu mesa en un par de pasos.
            </EmptyState>
          ) : (
            <EmptyState art="restaurantes" title="Tu historial está vacío">
              Aquí quedarán tus reservas completadas, canceladas o rechazadas.
            </EmptyState>
          ))}
          {state.status === "ready" && shown.length > 0 && (
            <ul className="grid gap-5 md:grid-cols-2">
              {shown.map((reservation) => (
                <ReservationCard key={reservation.id} reservation={reservation} onEdit={startEdit} onCancel={setCancelling} />
              ))}
            </ul>
          )}
        </section>
      </Page>

      <Modal
        open={Boolean(cancelling)}
        onClose={() => { if (!cancelBusy) setCancelling(null); }}
        size="sm"
        title={`¿Cancelar la reserva #${cancelling?.id ?? ""}?`}
        description="Esta acción no se puede deshacer."
        footer={(
          <>
            <Button variant="ghost" onClick={() => setCancelling(null)} disabled={cancelBusy}>Conservar reserva</Button>
            <Button variant="danger" loading={cancelBusy} onClick={confirmCancel}>Sí, cancelar</Button>
          </>
        )}
      >
        {cancelling && (
          <p className="text-sm text-piedra-800">
            <strong className="font-bold text-tinta">{cancelling.branchName || `Reserva #${cancelling.id}`}</strong><br />
            {formatDate(cancelling.reservationDate)} a las {hhmm(cancelling.reservationTime)}, {cancelling.partySize} {cancelling.partySize === 1 ? "persona" : "personas"}
          </p>
        )}
      </Modal>

      <Modal
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title={`Modificar reserva #${editing?.reservation.id ?? ""}`}
        description={editing ? `${editing.branch.restaurantName} · ${editing.branch.name} (${editing.branch.address}, ${editing.branch.city})` : undefined}
      >
        {editing && (
          <BookingPanel
            key={editing.reservation.id}
            branch={editing.branch}
            editing={editing.reservation}
            onCancel={() => setEditing(null)}
            onDone={() => { setEditing(null); load(); }}
          />
        )}
      </Modal>
    </SiteLayout>
  );
}
