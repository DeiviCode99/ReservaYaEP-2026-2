/* =====================================================================
   ReservaYa - Panel del cliente
   Muestra reservas activas e historial del usuario autenticado.
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

const countActive = document.querySelector("#count-active");
const nextDate = document.querySelector("#next-date");
const countHistory = document.querySelector("#count-history");

sessionLabel.textContent = user.name;

logoutBtn.addEventListener("click", logout);

const statusLabels = {
  PENDING: "Pendiente",
  CONFIRMED: "Confirmada",
  CANCELLED: "Cancelada",
  REJECTED: "Rechazada",
  COMPLETED: "Completada",
};

/* El color del distintivo es información: verde confirmada, mostaza en
   espera, ladrillo cancelada o rechazada, gris completada. */
const statusStyles = {
  PENDING: "badge-warn",
  CONFIRMED: "badge-ok",
  CANCELLED: "badge-alert",
  REJECTED: "badge-alert",
  COMPLETED: "badge-off",
};

/* "2026-09-24" → "24 de septiembre" */
function formatDate(value) {
  if (!value) return "";
  const parts = String(value).split("-");
  if (parts.length !== 3) return value;
  const date = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  return date.toLocaleDateString("es-CO", { day: "numeric", month: "long" });
}

function renderReservationCard(reservation) {
  const li = document.createElement("li");
  li.className = "restaurant-card";

  const dateStr = formatDate(reservation.reservationDate);
  const timeStr = reservation.reservationTime ? reservation.reservationTime.substring(0, 5) : "";
  const statusText = statusLabels[reservation.status] || reservation.status;
  const statusStyle = statusStyles[reservation.status] || "";
  const place = reservation.branchName || reservation.restaurantName || "Reserva #" + reservation.id;

  li.innerHTML =
    '<div class="restaurant-card-head">' +
      '<h3>' + escapeHtml(place) + '</h3>' +
      '<span class="badge ' + statusStyle + '">' + escapeHtml(statusText) + '</span>' +
    '</div>' +
    '<p class="restaurant-address">' + escapeHtml(dateStr) + ' a las ' + escapeHtml(timeStr) + '</p>' +
    '<p class="restaurant-meta">Para ' + reservation.partySize + ' personas (reserva #' + reservation.id + ')</p>';

  if (reservation.status === "PENDING" || reservation.status === "CONFIRMED") {
    const actions = document.createElement("div");
    actions.className = "restaurant-actions";
    const cancelBtn = document.createElement("button");
    cancelBtn.className = "button button-small button-danger";
    cancelBtn.type = "button";
    cancelBtn.textContent = "Cancelar";
    cancelBtn.addEventListener("click", function () { cancelReservation(reservation); });
    actions.appendChild(cancelBtn);
    li.appendChild(actions);
  }

  return li;
}

async function loadReservations() {
  try {
    const response = await fetch(API_BASE + "/api/reservations", {
      headers: authHeaders(),
    });

    if (response.status === 401) {
      handleUnauthorized();
      return;
    }

    const data = await response.json();
    const reservations = Array.isArray(data) ? data : [];

    const active = reservations.filter(function (r) {
      return r.status === "PENDING" || r.status === "CONFIRMED";
    });
    const history = reservations.filter(function (r) {
      return r.status !== "PENDING" && r.status !== "CONFIRMED";
    });

    reservationsList.innerHTML = "";
    historyList.innerHTML = "";

    if (active.length === 0) {
      reservationsEmpty.hidden = false;
      setEmptyText(reservationsEmpty, "No tienes reservas activas. Busca un restaurante y aparta tu mesa.");
    } else {
      reservationsEmpty.hidden = true;
      active.forEach(function (r) { reservationsList.appendChild(renderReservationCard(r)); });
    }

    if (history.length === 0) {
      historyEmpty.hidden = false;
      setEmptyText(historyEmpty, "Aquí quedarán tus reservas completadas, canceladas o rechazadas.");
    } else {
      historyEmpty.hidden = true;
      history.forEach(function (r) { historyList.appendChild(renderReservationCard(r)); });
    }

    updateSummary(active, history);
  } catch {
    reservationsEmpty.hidden = false;
    setEmptyText(reservationsEmpty, "No se pudo conectar con el servidor. Vuelve a intentarlo en un momento.");
  }
}

/* Cifras del resumen: cuentas reales, ninguna estimada. */
function updateSummary(active, history) {
  countActive.textContent = active.length;
  countHistory.textContent = history.length;

  const upcoming = active
    .slice()
    .sort(function (a, b) {
      return String(a.reservationDate).localeCompare(String(b.reservationDate));
    })[0];

  nextDate.textContent = upcoming ? formatDate(upcoming.reservationDate) : "—";
}

async function cancelReservation(reservation) {
  const confirmed = confirm(
    "¿Cancelar la reserva #" + reservation.id + "? Esta acción no se puede deshacer."
  );
  if (!confirmed) return;

  try {
    const response = await fetch(API_BASE + "/api/reservations/" + reservation.id, {
      method: "PATCH",
      headers: authHeaders(),
      body: JSON.stringify({ cancellationReason: "Cancelada por el cliente" }),
    });

    if (response.status === 401) {
      handleUnauthorized();
      return;
    }

    if (!response.ok) {
      const result = await response.json().catch(function () { return {}; });
      alert(result.message || "No se pudo cancelar la reserva.");
      return;
    }

    await loadReservations();
  } catch {
    alert("No se pudo conectar con el servidor.");
  }
}

loadReservations();
