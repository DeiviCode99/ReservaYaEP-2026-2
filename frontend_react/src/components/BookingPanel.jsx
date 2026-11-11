import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { CircleAlert, CircleCheck, Download, LogIn, Wallet } from "lucide-react";
import { Button } from "./ui/Button";
import { Chip } from "./ui/Select";
import { StatusBadge } from "./ui/Badge";
import { useToast } from "./ui/Toast";
import { DatePicker } from "./DatePicker";
import { Counter, TimeSlots } from "./TimeSlots";
import { Ticket, TicketCode } from "./Ticket";
import { apiFetch, EVENTS, formatDate, getUser, todayIso } from "../lib/api";
import { clampDate, depositFor, formatCurrency, formatLongDate, hhmm, reservationCode } from "../lib/format";
import { downloadConfirmation } from "../lib/pdf";

function Step({ number, id, title, children }) {
  return (
    <section className="border-t border-tinta/8 py-4 first:border-t-0 first:pt-0">
      <h3 id={id} className="mb-3 flex items-center gap-2.5 text-sm font-bold uppercase tracking-wide text-tinta">
        <span className="grid size-6 place-items-center rounded-full bg-rojo-600 text-xs font-extrabold text-white" aria-hidden="true">{number}</span>
        {title}
      </h3>
      {children}
    </section>
  );
}

/* Flujo de reserva: fecha → hora → personas → ocasión → confirmar.
   Con `editing` (una reserva) modifica en vez de crear (RF-09). */
export function BookingPanel({ branch, editing = null, onDone, onCancel }) {
  const user = getUser();
  const toast = useToast();
  const location = useLocation();
  const ids = useId();
  const [date, setDate] = useState(editing ? clampDate(editing.reservationDate) : todayIso());
  const [party, setParty] = useState(editing?.partySize || 2);
  const [event, setEvent] = useState(editing?.event || "NONE");
  const [slots, setSlots] = useState({ status: "idle", items: [], message: "" });
  const [slot, setSlot] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState(null);
  const request = useRef(0); // solo se pinta la última consulta, aunque lleguen desordenadas

  const canBook = user?.role === "CLIENT";

  const loadSlots = useCallback(async () => {
    const current = ++request.current;
    setSlot(null);
    setError("");
    if (!date || date < todayIso()) {
      setSlots({ status: "error", items: [], message: "Elige una fecha de hoy en adelante." });
      return;
    }
    setSlots({ status: "loading", items: [], message: "" });
    try {
      const data = await apiFetch(`/api/reservations/availability?branchId=${branch.id}&date=${date}`);
      if (current !== request.current) return;
      const all = Array.isArray(data.slots) ? data.slots : [];
      // Al modificar, los puestos de la propia reserva cuentan como libres.
      const sameDay = editing && editing.branchId === branch.id && editing.reservationDate === date;
      const adjusted = all.map((item) => (sameDay && item.time === editing.reservationTime
        ? { ...item, available: item.available + editing.partySize }
        : item));
      const open = adjusted.filter((item) => item.available > 0);
      if (!open.length) {
        setSlots({
          status: "empty",
          items: [],
          message: all.length === 0
            ? "La sede no atiende ese día (o ya pasaron sus horarios). Prueba con otra fecha."
            : "No hay disponibilidad ese día: todas las franjas están llenas.",
        });
        return;
      }
      setSlots({ status: "ready", items: open, message: "" });
      if (sameDay) setSlot(open.find((item) => item.time === editing.reservationTime) || null);
    } catch (failure) {
      if (current === request.current) setSlots({ status: "error", items: [], message: failure.message });
    }
  }, [branch.id, date, editing]);

  useEffect(() => { if (canBook) loadSlots(); }, [canBook, loadSlots]);

  const maxParty = Math.min(slot?.available ?? 50, 50);
  useEffect(() => { if (party > maxParty) setParty(maxParty); }, [party, maxParty]);

  async function submit(submitEvent) {
    submitEvent.preventDefault();
    if (!slot) return setError("Elige un horario con cupo.");
    if (!Number.isInteger(party) || party < 1 || party > slot.available) {
      return setError(`Este horario admite entre 1 y ${slot.available} personas.`);
    }
    setSaving(true);
    setError("");
    try {
      const reservation = await apiFetch(editing ? `/api/reservations/${editing.id}` : "/api/reservations", {
        method: editing ? "PUT" : "POST",
        body: JSON.stringify({ branchId: branch.id, reservationDate: date, reservationTime: slot.time, partySize: party, event }),
      });
      const named = { ...reservation, branchName: `${branch.restaurantName} · ${branch.name}` };
      if (editing) {
        toast(`Reserva #${reservation.id} modificada. Queda pendiente hasta que el restaurante la confirme.`, "success");
        onDone?.(named);
      } else {
        toast("Reserva creada. Queda pendiente hasta que el restaurante la confirme.", "success");
        setCreated(named);
        onDone?.(named);
      }
    } catch (failure) {
      setError(failure.message);
      loadSlots(); // los cupos pudieron cambiar
    } finally {
      setSaving(false);
    }
  }

  if (!user) {
    const next = encodeURIComponent(location.pathname + location.search);
    return (
      <div className="text-center">
        <p className="text-sm text-piedra-700">
          Para ver los horarios con cupo y apartar tu mesa necesitas una cuenta. Toma menos de un minuto.
        </p>
        <div className="mt-4 flex flex-col gap-2.5">
          <Button to={`/login?next=${next}`} size="lg" icon={LogIn}>Iniciar sesión para reservar</Button>
          <Button to={`/registro?next=${next}`} variant="secondary">Crear cuenta</Button>
        </div>
      </div>
    );
  }
  if (!canBook) {
    return (
      <p className="rounded-2xl bg-crema-100 px-4 py-3 text-sm text-piedra-800">
        Entraste con una cuenta de restaurante. Las reservas se hacen desde una cuenta de cliente.
      </p>
    );
  }

  if (created) {
    return (
      <div className="animate-surgir">
        <p className="mb-4 flex items-center gap-2 text-base font-bold text-exito-700">
          <CircleCheck size={22} aria-hidden="true" /> ¡Mesa apartada!
        </p>
        <Ticket surface="bg-papel" className="shadow-none" stub={<TicketCode code={reservationCode(created)} />}>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            {[
              ["A nombre de", user.name],
              ["Correo", user.email],
              ["Sede", created.branchName],
              ["Dirección", `${branch.address}, ${branch.city}`],
              ["Fecha y hora", `${formatDate(created.reservationDate)} · ${hhmm(created.reservationTime)}`],
              ["Personas", created.partySize],
              ["Ocasión", EVENTS[created.event] || "Ninguna"],
              ["Abono", formatCurrency(depositFor(created.partySize))],
            ].map(([term, detail]) => (
              <div key={term} className="contents">
                <dt className="text-piedra-600">{term}</dt>
                <dd className="break-words font-semibold text-tinta">{detail}</dd>
              </div>
            ))}
            <div className="contents">
              <dt className="text-piedra-600">Estado</dt>
              <dd><StatusBadge status={created.status} /></dd>
            </div>
          </dl>
        </Ticket>
        <div className="mt-4 flex flex-col gap-2.5">
          <Button to="/cliente" size="lg">Ver mis reservas</Button>
          <Button variant="secondary" icon={Download} onClick={() => downloadConfirmation(created).catch(() => toast("No se pudo preparar el PDF.", "error"))}>
            Descargar confirmación
          </Button>
          <Button variant="ghost" onClick={() => { setCreated(null); loadSlots(); }}>Hacer otra reserva aquí</Button>
        </div>
      </div>
    );
  }

  const deposit = formatCurrency(depositFor(party));

  return (
    <form onSubmit={submit} noValidate>
      <Step number="1" id={`${ids}-fecha`} title="Fecha">
        <DatePicker value={date} onChange={setDate} labelledBy={`${ids}-fecha`} />
      </Step>
      <Step number="2" id={`${ids}-hora`} title="Hora">
        <TimeSlots state={slots} value={slot} onChange={(next) => { setSlot(next); setError(""); }} labelledBy={`${ids}-hora`} />
      </Step>
      <Step number="3" id={`${ids}-personas`} title="Personas">
        <Counter value={party} onChange={setParty} max={maxParty} labelledBy={`${ids}-personas`} />
        {slot && maxParty < 50 && (
          <p className="mt-2 text-sm text-piedra-600">Este horario admite hasta {maxParty} {maxParty === 1 ? "persona" : "personas"}.</p>
        )}
      </Step>
      <Step number="4" id={`${ids}-ocasion`} title="Ocasión">
        <div role="radiogroup" aria-labelledby={`${ids}-ocasion`} className="flex flex-wrap gap-2">
          {Object.entries(EVENTS).map(([key, label]) => (
            <Chip key={key} role="radio" aria-checked={event === key} selected={event === key} onClick={() => setEvent(key)}>
              {label}
            </Chip>
          ))}
        </div>
      </Step>

      <div className="mt-1 rounded-2xl bg-crema-100 p-4">
        <p className="flex items-center justify-between gap-3 text-sm">
          <span className="flex items-center gap-2 text-piedra-800">
            <Wallet size={18} className="text-piedra-600" aria-hidden="true" /> Abono requerido
          </span>
          <strong className="text-lg font-extrabold tabular-nums text-tinta" aria-live="polite">{deposit}</strong>
        </p>
        <p className="mt-2 text-sm text-piedra-700" aria-live="polite">
          {slot
            ? <><span className="inline-block first-letter:uppercase">{formatLongDate(date)}</span> a las <strong className="tabular-nums">{hhmm(slot.time)}</strong>, {party} {party === 1 ? "persona" : "personas"}.</>
            : "Elige un horario para ver el resumen."}
        </p>
      </div>

      {error && (
        <p role="alert" className="mt-3 flex items-start gap-2 rounded-2xl bg-rojo-50 px-4 py-3 text-sm font-medium text-rojo-800">
          <CircleAlert size={18} className="mt-0.5 shrink-0" aria-hidden="true" /> {error}
        </p>
      )}

      <div className="mt-4 flex flex-col gap-2.5">
        <Button type="submit" size="lg" loading={saving} disabled={!slot}>
          {editing ? "Guardar cambios" : "Confirmar reserva"}
        </Button>
        {onCancel && <Button variant="ghost" onClick={onCancel}>No modificar</Button>}
      </div>
    </form>
  );
}
