/* Campanita: cada rol tiene un `check` que consulta el backend y devuelve los
   mensajes nuevos desde la última revisión. Lo último visto se guarda por
   usuario, así también avisa lo que pasó mientras no estaba. */
import { apiFetch, formatDate, getUser, todayIso } from "./api";
import { hhmm, isoDaysFromToday } from "./format";

export const CHANGES_EVENT = "reservaya:cambios";
const announceChanges = () => window.dispatchEvent(new CustomEvent(CHANGES_EVENT));

function snapshot(name) {
  const key = `reservaya.notify.${name}.${getUser()?.id}`;
  return {
    load() { try { return JSON.parse(localStorage.getItem(key)); } catch { return null; } },
    save(value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* sin almacenamiento */ } },
  };
}

/* La reserva solo trae branchId: "Restaurante · Sede" se pide una vez por sede. */
const branchLabels = {};
export async function branchLabel(branchId) {
  if (!(branchId in branchLabels)) {
    try {
      const branch = await apiFetch(`/api/restaurants/branches/${branchId}`);
      branchLabels[branchId] = `${branch.restaurantName} · ${branch.name}`;
    } catch {
      return null;
    }
  }
  return branchLabels[branchId];
}

/* Cliente: avisa cuando el restaurante responde. Los cambios que hace el
   propio cliente (crear, modificar, cancelar) no se notifican. */
const RESTAURANT_UPDATES = {
  CONFIRMED: "fue confirmada",
  REJECTED: "fue rechazada",
  COMPLETED: "quedó como completada",
};

export async function checkClient() {
  const store = snapshot("client-status");
  const reservations = await apiFetch("/api/reservations");
  if (!Array.isArray(reservations)) return [];
  const known = store.load() || {};
  store.save(Object.fromEntries(reservations.map((reservation) => [reservation.id, reservation.status])));

  const changed = reservations.filter((reservation) =>
    known[reservation.id] && known[reservation.id] !== reservation.status && RESTAURANT_UPDATES[reservation.status]);
  if (changed.length) announceChanges();
  return Promise.all(changed.map(async (reservation) => {
    const label = await branchLabel(reservation.branchId);
    return `Tu reserva #${reservation.id}${label ? ` en ${label}` : ""} del ${formatDate(reservation.reservationDate)} `
      + `${RESTAURANT_UPDATES[reservation.status]}.`
      + (reservation.status === "REJECTED" && reservation.cancellationReason ? ` Motivo: ${reservation.cancellationReason}` : "");
  }));
}

/* Administrador: sedes de todos sus restaurantes (para el filtro y la campanita). */
let adminBranches = null;
export function invalidateAdminBranches() { adminBranches = null; }
export async function loadAdminBranches() {
  if (adminBranches) return adminBranches;
  const restaurants = await apiFetch("/api/restaurants?mine=true");
  if (!Array.isArray(restaurants)) throw new Error("El servidor devolvió un formato de restaurantes inválido.");
  const groups = await Promise.all(restaurants.map(async (restaurant) => {
    const branches = await apiFetch(`/api/restaurants/${restaurant.id}/branches`);
    if (!Array.isArray(branches)) throw new Error("El servidor devolvió un formato de sedes inválido.");
    return branches.map((branch) => ({
      id: String(branch.id),
      label: `${restaurant.name} · ${branch.name}${branch.active === false ? " (inactiva)" : ""}`,
    }));
  }));
  adminBranches = groups.flat();
  return adminBranches;
}

/* Administrador: reservas pendientes nuevas en cualquiera de sus sedes. */
export async function checkAdmin() {
  const branches = await loadAdminBranches();
  if (!branches.length) return [];
  const store = snapshot("admin-pending");
  const perBranch = await Promise.all(branches.map(async (branch) => {
    const params = new URLSearchParams({ branchId: branch.id, from: todayIso(), to: isoDaysFromToday(365), status: "PENDING" });
    const list = await apiFetch(`/api/reservations?${params}`);
    return (Array.isArray(list) ? list : []).map((reservation) => ({ reservation, branch }));
  }));
  const pending = perBranch.flat();
  const known = new Set(store.load() || []);
  store.save(pending.map((item) => item.reservation.id));
  const fresh = pending.filter((item) => !known.has(item.reservation.id));
  if (fresh.length) announceChanges();
  return fresh.map(({ reservation, branch }) =>
    `Nueva reserva en ${branch.label}: ${formatDate(reservation.reservationDate)} a las ${hhmm(reservation.reservationTime)}, `
    + `${reservation.partySize} ${reservation.partySize === 1 ? "persona" : "personas"}.`);
}
