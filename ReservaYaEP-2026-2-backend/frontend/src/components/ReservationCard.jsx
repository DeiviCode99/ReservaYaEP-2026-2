import { useState } from "react";
import { CalendarDays, Download, PartyPopper, Pencil, Users, X } from "lucide-react";
import { Button } from "./ui/Button";
import { StatusBadge } from "./ui/Badge";
import { useToast } from "./ui/Toast";
import { Ticket, TicketCode } from "./Ticket";
import { EVENTS } from "../lib/api";
import { formatLongDate, hhmm, reservationCode, reservationIsActive } from "../lib/format";
import { downloadConfirmation } from "../lib/pdf";

/* Reserva del cliente. Activa: modificar y cancelar. Siempre: descargar PDF. */
export function ReservationCard({ reservation, onEdit, onCancel }) {
  const toast = useToast();
  const [downloading, setDownloading] = useState(false);
  const active = reservationIsActive(reservation);

  async function download() {
    setDownloading(true);
    try {
      await downloadConfirmation(reservation);
    } catch {
      toast("No se pudo preparar el PDF. Revisa tu conexión e inténtalo de nuevo.", "error");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <Ticket
      as="li"
      stub={(
        <div className="flex flex-wrap items-center justify-between gap-3">
          <TicketCode code={reservationCode(reservation)} />
          <div className="flex flex-wrap gap-2">
            {active && (
              <>
                <Button size="sm" variant="secondary" icon={Pencil} onClick={() => onEdit(reservation)}>Modificar</Button>
                <Button size="sm" variant="ghost" icon={X} className="text-rojo-700 hover:bg-rojo-50" onClick={() => onCancel(reservation)}>Cancelar</Button>
              </>
            )}
            <Button size="sm" variant="ghost" icon={Download} loading={downloading} onClick={download}>PDF</Button>
          </div>
        </div>
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-lg font-extrabold text-tinta">{reservation.branchName || `Reserva #${reservation.id}`}</h3>
        <StatusBadge status={reservation.status} className="mt-0.5" />
      </div>
      <p className="mt-3 flex items-baseline gap-2">
        <span className="text-3xl font-extrabold tabular-nums tracking-tight text-rojo-700">{hhmm(reservation.reservationTime)}</span>
        <span className="inline-block text-sm font-semibold text-tinta first-letter:uppercase">{formatLongDate(reservation.reservationDate)}</span>
      </p>
      <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-piedra-700">
        <li className="flex items-center gap-1.5">
          <Users size={16} className="text-piedra-500" aria-hidden="true" />
          {reservation.partySize} {reservation.partySize === 1 ? "persona" : "personas"}
        </li>
        <li className="flex items-center gap-1.5">
          <PartyPopper size={16} className="text-piedra-500" aria-hidden="true" />
          Ocasión: {EVENTS[reservation.event] || "Ninguna"}
        </li>
        <li className="flex items-center gap-1.5">
          <CalendarDays size={16} className="text-piedra-500" aria-hidden="true" />
          Reserva #{reservation.id}
        </li>
      </ul>
      {reservation.cancellationReason && (
        <p className="mt-3 rounded-xl bg-rojo-50 px-3 py-2 text-sm text-rojo-800">
          <strong className="font-bold">Motivo:</strong> {reservation.cancellationReason}
        </p>
      )}
    </Ticket>
  );
}
