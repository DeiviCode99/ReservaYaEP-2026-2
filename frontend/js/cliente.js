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

/* El color del distintivo es información: verde confirmada, mostaza en
   espera, ladrillo cancelada o rechazada, gris completada. */
const statusStyles = {
  PENDING: "badge-warn",
  CONFIRMED: "badge-ok",
  CANCELLED: "badge-alert",
  REJECTED: "badge-alert",
  COMPLETED: "badge-off",
};

const eventLabels = {
  NONE: "Ninguna",
  ROMANTIC_DINNER: "Cena romántica",
  BIRTHDAY: "Cumpleaños",
  WEDDING: "Boda",
};

/* "2026-09-24" → "24 de septiembre" */
function formatDate(value) {
  if (!value) return "";
  const parts = String(value).split("-");
  if (parts.length !== 3) return value;
  const date = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  return date.toLocaleDateString("es-CO", { day: "numeric", month: "long" });
}

function reservationCode(reservation) {
  return reservation.confirmationCode || "RESERVA-" + reservation.id;
}

function downloadConfirmation(reservation) {
  const JsPDF = window.jspdf && window.jspdf.jsPDF;
  if (!JsPDF) {
    alert("No se pudo preparar el PDF. Revisa tu conexión e inténtalo de nuevo.");
    return;
  }

  const pdf = new JsPDF();
  const time = reservation.reservationTime ? reservation.reservationTime.substring(0, 5) : "";
  pdf.setTextColor(107, 22, 38);
  pdf.setFontSize(22);
  pdf.text("ReservaYa", 20, 25);
  pdf.setTextColor(38, 22, 26);
  pdf.setFontSize(16);
  pdf.text("Confirmación de reserva", 20, 42);
  pdf.setFontSize(11);
  pdf.text("Código: " + reservationCode(reservation), 20, 58);
  pdf.text("Sede: " + (reservation.branchName || "No disponible"), 20, 70);
  pdf.text("Fecha: " + formatDate(reservation.reservationDate), 20, 82);
  pdf.text("Hora: " + time, 20, 94);
  pdf.text("Personas: " + reservation.partySize, 20, 106);
  pdf.text("Ocasión: " + (eventLabels[reservation.event] || "Ninguna"), 20, 118);
  pdf.text("Estado: " + (statusLabels[reservation.status] || reservation.status), 20, 130);
  pdf.setDrawColor(233, 178, 60);
  pdf.line(20, 140, 190, 140);
  pdf.setFontSize(10);
  pdf.setTextColor(124, 102, 107);
  pdf.text("Presenta este código al restaurante.", 20, 153);
  pdf.save("reserva-" + reservationCode(reservation) + ".pdf");
}

function renderReservationCard(reservation) {
  const li = document.createElement("li");
  li.className = "restaurant-card";

  const timeStr = reservation.reservationTime ? reservation.reservationTime.substring(0, 5) : "";
  const place = reservation.branchName || "Reserva #" + reservation.id;

  li.innerHTML =
    '<div class="restaurant-card-head">' +
      '<h3>' + escapeHtml(place) + '</h3>' +
      '<span class="badge ' + statusStyle + '">' + escapeHtml(statusText) + '</span>' +
    '</div>' +
    '<p class="restaurant-address">' + escapeHtml(dateStr) + ' a las ' + escapeHtml(timeStr) + '</p>' +
    '<p class="restaurant-meta">Para ' + reservation.partySize + ' personas · ocasión: ' +
      escapeHtml(eventLabels[reservation.event] || "Ninguna") + '</p>' +
    '<p class="restaurant-meta">Código: <strong>' + escapeHtml(reservationCode(reservation)) + '</strong></p>';

  if (isActive(reservation)) {
    const actions = document.createElement("div");
    actions.className = "restaurant-actions";
    const editBtn = document.createElement("button");
    editBtn.className = "button button-small button-outline";
    editBtn.type = "button";
    editBtn.textContent = "Modificar";
    editBtn.addEventListener("click", function () { editReservation(reservation); });
    actions.appendChild(editBtn);
    const cancelBtn = document.createElement("button");
    cancelBtn.className = "button button-small button-danger";
    cancelBtn.type = "button";
    cancelBtn.textContent = "Cancelar";
    cancelBtn.addEventListener("click", function () { cancelReservation(reservation); });
    actions.appendChild(cancelBtn);
    const pdfBtn = document.createElement("button");
    pdfBtn.className = "button button-small button-outline";
    pdfBtn.type = "button";
    pdfBtn.textContent = "Descargar PDF";
    pdfBtn.addEventListener("click", function () { downloadConfirmation(reservation); });
    actions.appendChild(pdfBtn);
    li.appendChild(actions);
  } else {
    const actions = document.createElement("div");
    actions.className = "restaurant-actions";
    const pdfBtn = document.createElement("button");
    pdfBtn.className = "button button-small button-outline";
    pdfBtn.type = "button";
    pdfBtn.textContent = "Descargar PDF";
    pdfBtn.addEventListener("click", function () { downloadConfirmation(reservation); });
    actions.appendChild(pdfBtn);
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
