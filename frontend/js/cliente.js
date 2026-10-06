/* =====================================================================
   ReservaYa - Panel del cliente
   Muestra reservas activas e historial del usuario autenticado.
   Usa auth.js (apiFetch, statusBadge, formatDate, errorText) y
   reservar.js (editReservation).
   ===================================================================== */

if (!requireRole("CLIENT")) {
  // requireRole redirige automáticamente; este bloque detiene la ejecución.
}

const user = getUser();
const sessionLabel = document.querySelector("#session-label");
const logoutBtn = document.querySelector("#logout-button");

const reservationsEmpty = document.querySelector("#reservations-empty");
const reservationsList = document.querySelector("#reservations-list");
const historyEmpty = document.querySelector("#history-empty");
const historyList = document.querySelector("#history-list");
const reservationFeedback = document.querySelector("#reservation-feedback");

const countActive = document.querySelector("#count-active");
const nextDate = document.querySelector("#next-date");
const countHistory = document.querySelector("#count-history");

sessionLabel.textContent = user.name;
logoutBtn.addEventListener("click", logout);

function isActive(reservation) {
  return reservation.status === "PENDING" || reservation.status === "CONFIRMED";
}

function actionButton(text, style, onClick) {
  const button = document.createElement("button");
  button.className = "button button-small " + style;
  button.type = "button";
  button.textContent = text;
  button.addEventListener("click", onClick);
  return button;
}

function renderReservationCard(reservation) {
  const li = document.createElement("li");
  li.className = "restaurant-card";

  const timeStr = reservation.reservationTime ? reservation.reservationTime.substring(0, 5) : "";
  const place = reservation.branchName || "Reserva #" + reservation.id;

  li.innerHTML =
    '<div class="restaurant-card-head">' +
      "<h3>" + escapeHtml(place) + "</h3>" +
      statusBadge(reservation.status) +
    "</div>" +
    '<p class="restaurant-address">' + escapeHtml(formatDate(reservation.reservationDate)) +
      " a las " + escapeHtml(timeStr) + "</p>" +
    '<p class="restaurant-meta">Para ' + reservation.partySize + " personas (reserva #" + reservation.id + ")</p>" +
    (reservation.status === "REJECTED" && reservation.cancellationReason
      ? '<p class="restaurant-meta">Motivo: ' + escapeHtml(reservation.cancellationReason) + "</p>"
      : "");

  if (isActive(reservation)) {
    const actions = document.createElement("div");
    actions.className = "restaurant-actions";
    actions.appendChild(actionButton("Modificar", "button-outline",
      function () { editReservation(reservation); }));
    actions.appendChild(actionButton("Cancelar", "button-danger",
      function () { cancelReservation(reservation); }));
    li.appendChild(actions);
  }

  return li;
}

/* La reserva solo trae branchId: "Restaurante · Sede" se pide una vez por sede. */
const branchNames = {};

async function addBranchNames(reservations) {
  const missing = [...new Set(reservations.map(function (r) { return r.branchId; }))]
    .filter(function (id) { return !(id in branchNames); });

  await Promise.all(missing.map(async function (id) {
    try {
      const branch = await apiFetch("/api/restaurants/branches/" + id);
      branchNames[id] = branch.restaurantName + " · " + branch.name;
    } catch {
      branchNames[id] = null;
    }
  }));

  reservations.forEach(function (r) { r.branchName = branchNames[r.branchId]; });
}

function renderList(list, empty, items, emptyMessage) {
  list.innerHTML = "";
  empty.hidden = items.length > 0;
  if (items.length === 0) setEmptyText(empty, emptyMessage);
  items.forEach(function (r) { list.appendChild(renderReservationCard(r)); });
}

async function loadReservations() {
  try {
    const reservations = await apiFetch("/api/reservations");
    await addBranchNames(reservations);

    const active = reservations.filter(isActive);
    const history = reservations.filter(function (r) { return !isActive(r); });

    renderList(reservationsList, reservationsEmpty, active,
      "No tienes reservas activas. Busca una sede arriba y aparta tu mesa.");
    renderList(historyList, historyEmpty, history,
      "Aquí quedarán tus reservas completadas, canceladas o rechazadas.");
    updateSummary(active, history);
  } catch (error) {
    reservationsEmpty.hidden = false;
    setEmptyText(reservationsEmpty, errorText(error));
  }
}

/* Cifras del resumen: cuentas reales, ninguna estimada. */
function updateSummary(active, history) {
  countActive.textContent = active.length;
  countHistory.textContent = history.length;

  const upcoming = active
    .slice()
    .sort(function (a, b) {
      return String(a.reservationDate + a.reservationTime).localeCompare(String(b.reservationDate + b.reservationTime));
    })[0];

  nextDate.textContent = upcoming ? formatDate(upcoming.reservationDate) : "—";
}

async function cancelReservation(reservation) {
  const confirmed = confirm(
    "¿Cancelar la reserva #" + reservation.id + "? Esta acción no se puede deshacer."
  );
  if (!confirmed) return;

  try {
    await apiFetch("/api/reservations/" + reservation.id, {
      method: "PATCH",
      body: JSON.stringify({ cancellationReason: "Cancelada por el cliente" }),
    });
    await loadReservations();
    showStatus(reservationFeedback, "La reserva #" + reservation.id + " fue cancelada correctamente.", "success");
  } catch (error) {
    showStatus(reservationFeedback, errorText(error), "error");
  }
}

loadReservations();

/* Campanita: avisa cuando el restaurante responde. Los cambios que hace el
   propio cliente (crear, modificar, cancelar) no se notifican. */
const statusSnapshot = notifySnapshot("client-status");
const RESTAURANT_UPDATES = {
  CONFIRMED: "fue confirmada",
  REJECTED: "fue rechazada",
  COMPLETED: "quedó como completada",
};

async function checkStatusChanges() {
  const reservations = await apiFetch("/api/reservations");
  const known = statusSnapshot.load() || {};
  const current = {};
  reservations.forEach(function (r) { current[r.id] = r.status; });
  statusSnapshot.save(current);

  const changed = reservations.filter(function (r) {
    return known[r.id] && known[r.id] !== r.status && RESTAURANT_UPDATES[r.status];
  });
  if (changed.length) loadReservations();
  return changed.map(function (r) {
    const place = branchNames[r.branchId] ? " en " + branchNames[r.branchId] : "";
    return "Tu reserva #" + r.id + place + " del " + formatDate(r.reservationDate) + " " +
      RESTAURANT_UPDATES[r.status] + "." +
      (r.status === "REJECTED" && r.cancellationReason ? " Motivo: " + r.cancellationReason : "");
  });
}

setupNotifications(checkStatusChanges);
