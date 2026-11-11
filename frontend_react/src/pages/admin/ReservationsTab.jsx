import { useCallback, useEffect, useRef, useState } from "react";
import { Check, CheckCheck, Mail, X } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { Field, Input, Textarea } from "../../components/ui/Input";
import { Chip, Select } from "../../components/ui/Select";
import { StatusBadge } from "../../components/ui/Badge";
import { Card, Stat } from "../../components/ui/Card";
import { Modal } from "../../components/ui/Modal";
import { Loading, Skeleton } from "../../components/ui/Skeleton";
import { EmptyState } from "../../components/ui/EmptyState";
import { useToast } from "../../components/ui/Toast";
import { apiFetch, EVENTS, formatDate, STATUS, todayIso } from "../../lib/api";
import { hhmm, isoDaysFromToday, reservationCode } from "../../lib/format";
import { CHANGES_EVENT, loadAdminBranches } from "../../lib/notifications";

/* Qué puede hacer el restaurante en cada estado (espejo de ReservationStatus
   en el backend, que es quien valida de verdad). */
const ACTIONS = {
  PENDING: [
    { label: "Confirmar", next: "CONFIRMED", variant: "primary", icon: Check },
    { label: "Rechazar", next: "REJECTED", variant: "secondary", icon: X, askReason: true },
  ],
  CONFIRMED: [
    { label: "Completar", next: "COMPLETED", variant: "secondary", icon: CheckCheck },
  ],
};

function Customer({ reservation }) {
  return (
    <>
      <span className="block font-bold text-tinta">{reservation.customerName || `Cliente #${reservation.userId}`}</span>
      {reservation.customerEmail && (
        <a href={`mailto:${reservation.customerEmail}`} className="inline-flex items-center gap-1 text-sm [overflow-wrap:anywhere] text-piedra-700 underline decoration-piedra-300 underline-offset-2 hover:text-rojo-700">
          <Mail size={13} className="shrink-0" aria-hidden="true" /> {reservation.customerEmail}
        </a>
      )}
    </>
  );
}

function RowActions({ reservation, busy, onAction }) {
  const actions = ACTIONS[reservation.status] || [];
  if (!actions.length) return <span className="text-sm text-piedra-500">Sin acciones</span>;
  return (
    <div className="flex flex-wrap gap-2">
      {actions.map((action) => (
        <Button
          key={action.next}
          size="sm"
          variant={action.variant}
          icon={action.icon}
          loading={busy === `${reservation.id}:${action.next}`}
          disabled={Boolean(busy)}
          onClick={() => onAction(reservation, action)}
          aria-label={`${action.label} la reserva #${reservation.id}`}
        >
          {action.label}
        </Button>
      ))}
    </div>
  );
}

/* RF-10: reservas de una sede por rango de fechas y estado.
   RF-11: confirmar o rechazar las pendientes y completar las confirmadas. */
export function ReservationsTab({ branchesVersion }) {
  const toast = useToast();
  const [branches, setBranches] = useState({ status: "loading", items: [] });
  const [filters, setFilters] = useState({ branchId: "", from: todayIso(), to: isoDaysFromToday(30), status: "" });
  const [state, setState] = useState({ status: "idle", items: [], message: "" });
  const [busy, setBusy] = useState("");
  const [rejecting, setRejecting] = useState(null);
  const [reason, setReason] = useState("");
  const request = useRef(0); // descarta respuestas viejas si cambian los filtros rápido

  useEffect(() => {
    let active = true;
    loadAdminBranches()
      .then((items) => {
        if (!active) return;
        setBranches({ status: "ready", items });
        setFilters((current) => ({
          ...current,
          branchId: items.some((branch) => branch.id === current.branchId) ? current.branchId : items[0]?.id || "",
        }));
      })
      .catch((error) => { if (active) { setBranches({ status: "ready", items: [] }); toast(error.message, "error"); } });
    return () => { active = false; };
  }, [branchesVersion, toast]);

  const { branchId, from, to } = filters;
  const rangeError = from && to && from > to ? "La fecha inicial no puede ser posterior a la fecha final." : "";

  const load = useCallback(async ({ quiet = false } = {}) => {
    if (!branchId || (!from && !to) || rangeError) return;
    const current = ++request.current;
    if (!quiet) setState((previous) => ({ ...previous, status: "loading" }));
    try {
      const params = new URLSearchParams({ branchId });
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      const data = await apiFetch(`/api/reservations?${params}`);
      if (current === request.current) setState({ status: "ready", items: Array.isArray(data) ? data : [], message: "" });
    } catch (error) {
      if (current === request.current) setState({ status: "error", items: [], message: error.message });
    }
  }, [branchId, from, to, rangeError]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    // La campanita detectó reservas nuevas: la lista abierta se actualiza sola.
    const refresh = () => load({ quiet: true });
    window.addEventListener(CHANGES_EVENT, refresh);
    return () => window.removeEventListener(CHANGES_EVENT, refresh);
  }, [load]);

  async function changeStatus(reservation, next, cancellationReason = null) {
    setBusy(`${reservation.id}:${next}`);
    try {
      await apiFetch(`/api/reservations/${reservation.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: next, cancellationReason: cancellationReason || null }),
      });
      toast(`Reserva #${reservation.id}: ${STATUS[next][0].toLowerCase()}.`, "success");
      setRejecting(null);
      await load({ quiet: true });
    } catch (error) {
      toast(error.message, "error");
    } finally {
      setBusy("");
    }
  }

  function onAction(reservation, action) {
    if (action.askReason) { setReason(""); setRejecting(reservation); return; }
    changeStatus(reservation, action.next);
  }

  // Cifras del rango completo, sin importar el filtro de estado.
  const all = state.items;
  const pending = all.filter((reservation) => reservation.status === "PENDING").length;
  const confirmed = all.filter((reservation) => reservation.status === "CONFIRMED").length;
  const people = all.filter((reservation) => ["PENDING", "CONFIRMED"].includes(reservation.status))
    .reduce((sum, reservation) => sum + reservation.partySize, 0);
  const shown = (filters.status ? all.filter((reservation) => reservation.status === filters.status) : all)
    .slice().sort((a, b) => `${a.reservationDate}${a.reservationTime}`.localeCompare(`${b.reservationDate}${b.reservationTime}`));
  const rangeLabel = (from || to) === (to || from) ? formatDate(from || to) : `${formatDate(from)} – ${formatDate(to)}`;
  const noBranches = branches.status === "ready" && branches.items.length === 0;

  if (noBranches) {
    return (
      <EmptyState art="restaurantes" title="Aún no tienes sedes">
        Registra un restaurante y una sede en la pestaña «Restaurantes y sedes» para empezar a recibir reservas.
      </EmptyState>
    );
  }

  return (
    <div>
      <Card className="p-4 sm:p-5">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[1.6fr_1fr_1fr]">
          <Field label="Sede">
            <Select value={branchId} onChange={(event) => setFilters({ ...filters, branchId: event.target.value })} disabled={branches.status !== "ready"}>
              {branches.status !== "ready" && <option value="">Cargando sedes…</option>}
              {branches.items.map((branch) => <option key={branch.id} value={branch.id}>{branch.label}</option>)}
            </Select>
          </Field>
          <Field label="Desde" error={rangeError}>
            <Input type="date" value={from} onChange={(event) => setFilters({ ...filters, from: event.target.value })} />
          </Field>
          <Field label="Hasta">
            <Input type="date" value={to} onChange={(event) => setFilters({ ...filters, to: event.target.value })} />
          </Field>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <span id="filtro-estado" className="shrink-0 text-xs font-bold uppercase tracking-wide text-piedra-700">Estado</span>
          <div role="group" aria-labelledby="filtro-estado" className="-my-1 flex gap-2 overflow-x-auto py-1 pr-1">
            <Chip selected={!filters.status} aria-pressed={!filters.status} onClick={() => setFilters({ ...filters, status: "" })}>Todos</Chip>
            {Object.entries(STATUS).map(([key, [label]]) => (
              <Chip key={key} selected={filters.status === key} aria-pressed={filters.status === key}
                onClick={() => setFilters({ ...filters, status: filters.status === key ? "" : key })}>
                {label}
              </Chip>
            ))}
          </div>
        </div>
      </Card>

      <section aria-label="Resumen del rango" className="mt-4 grid grid-cols-3 gap-3">
        <Stat tone={pending ? "accent" : "plain"} value={pending} label="Por responder" />
        <Stat value={confirmed} label="Confirmadas" />
        <Stat value={people} label="Personas esperadas" />
      </section>

      <div className="mt-5">
        {(state.status === "loading" || state.status === "idle") && (
          <Loading label="Cargando reservas…" className="space-y-2.5">
            {[0, 1, 2, 3].map((index) => <Skeleton key={index} className="h-16 rounded-2xl" />)}
          </Loading>
        )}
        {state.status === "error" && (
          <EmptyState art="reservas" title="No se pudieron cargar las reservas" action={<Button variant="secondary" onClick={() => load()}>Reintentar</Button>}>
            {state.message}
          </EmptyState>
        )}
        {state.status === "ready" && shown.length === 0 && (
          <EmptyState art="reservas" title="Sin reservas">
            {all.length === 0 ? `No hay reservas para esta sede en ${rangeLabel}.` : "No hay reservas con ese estado en este rango."}
          </EmptyState>
        )}
        {state.status === "ready" && shown.length > 0 && (
          <>
            {/* Escritorio: tabla */}
            <Card className="hidden overflow-hidden md:block">
              <table className="w-full text-left text-sm">
                <caption className="sr-only">Reservas de la sede en {rangeLabel}</caption>
                <thead className="bg-crema-50 text-xs font-bold uppercase tracking-wide text-piedra-700">
                  <tr>
                    <th scope="col" className="px-4 py-3">Fecha y hora</th>
                    <th scope="col" className="px-4 py-3">Cliente</th>
                    <th scope="col" className="px-4 py-3">Personas</th>
                    <th scope="col" className="px-4 py-3">Ocasión</th>
                    <th scope="col" className="px-4 py-3">Estado</th>
                    <th scope="col" className="px-4 py-3">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-tinta/8">
                  {shown.map((reservation) => (
                    <tr key={reservation.id} className="align-top transition-colors hover:bg-mostaza-50">
                      <td className="px-4 py-3.5">
                        <span className="block text-lg font-extrabold leading-tight tabular-nums text-rojo-700">{hhmm(reservation.reservationTime)}</span>
                        <span className="whitespace-nowrap text-piedra-700">{formatDate(reservation.reservationDate)}</span>
                      </td>
                      <td className="px-4 py-3.5">
                        <Customer reservation={reservation} />
                        <span className="mt-0.5 block font-mono text-xs text-piedra-600">#{reservation.id} · {reservationCode(reservation)}</span>
                      </td>
                      <td className="px-4 py-3.5 font-bold tabular-nums">{reservation.partySize}</td>
                      <td className="px-4 py-3.5 text-piedra-800">{EVENTS[reservation.event] || "Ninguna"}</td>
                      <td className="px-4 py-3.5">
                        <StatusBadge status={reservation.status} />
                        {reservation.cancellationReason && (
                          <span className="mt-1.5 block max-w-48 text-xs text-piedra-700">Motivo: {reservation.cancellationReason}</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5"><RowActions reservation={reservation} busy={busy} onAction={onAction} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>

            {/* Móvil: tarjetas */}
            <ul className="space-y-3 md:hidden">
              {shown.map((reservation) => (
                <Card as="li" key={reservation.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <p>
                      <span className="text-2xl font-extrabold tabular-nums text-rojo-700">{hhmm(reservation.reservationTime)}</span>{" "}
                      <span className="text-sm font-semibold text-piedra-700">{formatDate(reservation.reservationDate)}</span>
                    </p>
                    <StatusBadge status={reservation.status} />
                  </div>
                  <div className="mt-2"><Customer reservation={reservation} /></div>
                  <p className="mt-2 text-sm text-piedra-700">
                    {reservation.partySize} {reservation.partySize === 1 ? "persona" : "personas"} · {EVENTS[reservation.event] || "Ninguna"} · reserva #{reservation.id}
                  </p>
                  {reservation.cancellationReason && <p className="mt-1 text-sm text-piedra-700">Motivo: {reservation.cancellationReason}</p>}
                  {ACTIONS[reservation.status] && (
                    <div className="mt-3 border-t border-tinta/8 pt-3"><RowActions reservation={reservation} busy={busy} onAction={onAction} /></div>
                  )}
                </Card>
              ))}
            </ul>
          </>
        )}
      </div>

      <Modal
        open={Boolean(rejecting)}
        onClose={() => { if (!busy) setRejecting(null); }}
        size="sm"
        title={`¿Rechazar la reserva #${rejecting?.id ?? ""}?`}
        description={rejecting ? `${rejecting.customerName || `Cliente #${rejecting.userId}`} · ${formatDate(rejecting.reservationDate)} a las ${hhmm(rejecting.reservationTime)}` : undefined}
        footer={(
          <>
            <Button variant="ghost" onClick={() => setRejecting(null)} disabled={Boolean(busy)}>Volver</Button>
            <Button variant="danger" loading={Boolean(busy)} onClick={() => changeStatus(rejecting, "REJECTED", reason.trim())}>Rechazar reserva</Button>
          </>
        )}
      >
        <Field label="Motivo del rechazo" optional hint="El cliente lo verá en su panel.">
          <Textarea value={reason} onChange={(event) => setReason(event.target.value)} maxLength={255} placeholder="Ej. Ese día tenemos un evento privado." />
        </Field>
      </Modal>
    </div>
  );
}
