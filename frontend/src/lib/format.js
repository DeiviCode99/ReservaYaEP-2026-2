import { todayIso } from "./api";

/* Ciudades del área metropolitana. La búsqueda compara el texto exacto, así
   que el administrador elige de esta misma lista. */
export const CITIES = ["Bucaramanga", "Floridablanca", "Girón", "Piedecuesta"];
/* dayOfWeek del backend: 1 = lunes … 7 = domingo. */
export const DAYS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export const hhmm = (time) => String(time || "").slice(0, 5);

export function formatCurrency(amount) {
  return Number(amount).toLocaleString("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });
}

/* Regla del Sprint 2: abono de $50.000 hasta 3 personas, $100.000 desde 4.
   Solo informativo: el backend aún no registra el abono. */
export const depositFor = (party) => (Number(party) <= 3 ? 50000 : 100000);

export const reservationCode = (reservation) => reservation.confirmationCode || `RESERVA-${reservation.id}`;

/* Activa = pendiente o confirmada y aún por venir. Una reserva cuya hora ya
   pasó va al historial aunque nadie la haya marcado como completada. */
export function reservationIsActive(reservation) {
  return ["PENDING", "CONFIRMED"].includes(reservation.status)
    && new Date(`${reservation.reservationDate}T${reservation.reservationTime}`) > new Date();
}

export function toIso(date) {
  const copy = new Date(date);
  copy.setMinutes(copy.getMinutes() - copy.getTimezoneOffset());
  return copy.toISOString().slice(0, 10);
}

export function isoDaysFromToday(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return toIso(date);
}

export function parseIso(value) {
  const [year, month, day] = String(value).split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function formatLongDate(value) {
  if (!value) return "";
  return parseIso(value).toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long" });
}

export const homeFor = (user) => (user?.role === "RESTAURANT_ADMIN" ? "/admin" : "/cliente");

/* Horario de hoy de una sede, o null si no lo informa. */
export function todaySchedule(branch) {
  const day = new Date().getDay() || 7;
  return (branch.schedules || []).find((schedule) => schedule.dayOfWeek === day) || null;
}

export function todayLabel(branch) {
  const schedule = todaySchedule(branch);
  if (!schedule) return null;
  return schedule.isClosed ? "Cerrado hoy" : `Hoy ${hhmm(schedule.openTime)} – ${hhmm(schedule.closeTime)}`;
}

export const clampDate = (value) => (value < todayIso() ? todayIso() : value);
