/* =====================================================================
   ReservaYa - Panel de administración: reservas de las sedes
   RF-10: ver las reservas de una sede por fecha (y filtrar por estado).
   RF-11: confirmar o rechazar las pendientes y completar las confirmadas.
   Usa auth.js (apiFetch, showStatus, statusBadge, formatDate, todayIso,
   errorText). admin.js llama a refreshReservationBranches() al guardar sedes.
   ===================================================================== */

const filterBranch = document.querySelector("#filter-branch");
const filterFrom = document.querySelector("#filter-from");
const filterTo = document.querySelector("#filter-to");
const filterStatus = document.querySelector("#filter-status");
const adminReservationsStatus = document.querySelector("#admin-reservations-status");
const adminReservationsEmpty = document.querySelector("#admin-reservations-empty");
const adminReservationsList = document.querySelector("#admin-reservations-list");
const countPending = document.querySelector("#count-pending");
const countConfirmed = document.querySelector("#count-confirmed");
const countPeople = document.querySelector("#count-people");

let dayReservations = [];
let reservationsRequest = 0; // descarta respuestas viejas si cambian los filtros rápido

/* Qué puede hacer el restaurante en cada estado (espejo de ReservationStatus
   en el backend, que es quien valida de verdad). */
const RESTAURANT_ACTIONS = {
  PENDING: [
    { label: "Confirmar", next: "CONFIRMED", style: "" },
    { label: "Rechazar", next: "REJECTED", style: "button-danger", askReason: true },
  ],
  CONFIRMED: [
    { label: "Marcar completada", next: "COMPLETED", style: "button-outline" },
  ],
};

/* ── Sedes del administrador para el filtro ───────────────────────── */

async function refreshReservationBranches() {
  const previous = filterBranch.value;
  try {
    const restaurants = await apiFetch("/api/restaurants?mine=true");
    const groups = await Promise.all(restaurants.map(function (restaurant) {
      return apiFetch("/api/restaurants/" + restaurant.id + "/branches").then(function (branches) {
        return branches.map(function (branch) {
          return { id: String(branch.id), label: restaurant.name + " · " + branch.name +
            (branch.active ? "" : " (inactiva)") };
        });
      });
    }));
    const options = groups.flat();

    filterBranch.innerHTML = "";
    if (options.length === 0) {
      filterBranch.add(new Option("Aún no tienes sedes", ""));
      filterBranch.disabled = true;
      renderReservations([]);
      showStatus(adminReservationsStatus, "Registra un restaurante y una sede para empezar a recibir reservas.");
      return;
    }
    options.forEach(function (o) { filterBranch.add(new Option(o.label, o.id)); });
    filterBranch.disabled = false;
    if (options.some(function (o) { return o.id === previous; })) filterBranch.value = previous;
    loadBranchReservations();
  } catch (error) {
    showStatus(adminReservationsStatus, errorText(error), "error");
  }
}

/* ── Reservas por fecha o rango ────────────────────────────────────── */

async function loadBranchReservations() {
  if (!filterBranch.value || (!filterFrom.value && !filterTo.value)) return;
  if (filterFrom.value && filterTo.value && filterFrom.value > filterTo.value) {
    showStatus(adminReservationsStatus, "La fecha inicial no puede ser posterior a la fecha final.", "error");
    return;
  }
  const request = ++reservationsRequest;
  showStatus(adminReservationsStatus, "Cargando reservas...");
  try {
    const params = new URLSearchParams({ branchId: filterBranch.value });
    if (filterFrom.value) params.set("from", filterFrom.value);
    if (filterTo.value) params.set("to", filterTo.value);
    const data = await apiFetch("/api/reservations?" + params);
    if (request !== reservationsRequest) return;
    showStatus(adminReservationsStatus, "");
    renderReservations(data);
  } catch (error) {
    if (request === reservationsRequest) showStatus(adminReservationsStatus, errorText(error), "error");
  }
}

/* Cifras del rango completo, sin importar el filtro de estado. */
function updateRangeSummary() {
  const active = dayReservations.filter(function (r) {
    return r.status === "PENDING" || r.status === "CONFIRMED";
  });
  countPending.textContent = dayReservations.filter(function (r) { return r.status === "PENDING"; }).length;
  countConfirmed.textContent = dayReservations.filter(function (r) { return r.status === "CONFIRMED"; }).length;
  countPeople.textContent = active.reduce(function (sum, r) { return sum + r.partySize; }, 0);
}

function renderReservations(reservations) {
  dayReservations = reservations;
  updateRangeSummary();

  const shown = filterStatus.value
    ? dayReservations.filter(function (r) { return r.status === filterStatus.value; })
    : dayReservations;

  adminReservationsList.innerHTML = "";
  adminReservationsEmpty.hidden = shown.length > 0 || filterBranch.disabled;
  // Con una sola fecha, el backend consulta ese día.
  const from = filterFrom.value || filterTo.value;
  const to = filterTo.value || filterFrom.value;
  const rangeLabel = from === to ? formatDate(from) : formatDate(from) + " - " + formatDate(to);
  setEmptyText(adminReservationsEmpty, dayReservations.length === 0
    ? "No hay reservas para esta sede en " + rangeLabel + "."
    : "No hay reservas con ese estado en este rango.");
  shown.forEach(function (r) { adminReservationsList.appendChild(reservationCard(r)); });
}

function reservationCard(reservation) {
  const li = document.createElement("li");
  li.className = "restaurant-card";
  const time = reservation.reservationTime.substring(0, 5);
  const customer = reservation.customerName || "Cliente #" + reservation.userId;

  li.innerHTML =
    '<div class="restaurant-card-head">' +
      "<h3>" + escapeHtml(time + " · " + customer) + "</h3>" +
      statusBadge(reservation.status) +
    "</div>" +
    (reservation.customerEmail
      ? '<p class="restaurant-address"><a href="mailto:' + escapeHtml(reservation.customerEmail) + '">' +
        escapeHtml(reservation.customerEmail) + "</a></p>"
      : "") +
    '<p class="restaurant-meta">' + reservation.partySize + " personas · reserva #" + reservation.id + "</p>" +
    (reservation.cancellationReason
      ? '<p class="restaurant-meta">Motivo: ' + escapeHtml(reservation.cancellationReason) + "</p>"
      : "");

  const actions = RESTAURANT_ACTIONS[reservation.status] || [];
  if (actions.length) {
    const box = document.createElement("div");
    box.className = "restaurant-actions";
    actions.forEach(function (action) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "button button-small " + action.style;
      button.textContent = action.label;
      button.addEventListener("click", function () { changeStatus(reservation, action, box); });
      box.appendChild(button);
    });
    li.appendChild(box);
  }
  return li;
}

async function changeStatus(reservation, action, buttons) {
  let reason = null;
  if (action.askReason) {
    reason = prompt("Motivo del rechazo (opcional). El cliente lo verá en su panel:", "");
    if (reason === null) return; // pulsó Cancelar
  }

  buttons.querySelectorAll("button").forEach(function (b) { b.disabled = true; });
  try {
    await apiFetch("/api/reservations/" + reservation.id + "/status", {
      method: "PATCH",
      body: JSON.stringify({ status: action.next, cancellationReason: reason || null }),
    });
    showStatus(adminReservationsStatus,
      "Reserva #" + reservation.id + ": " + RESERVATION_STATUS[action.next].label.toLowerCase() + ".", "success");
    const message = adminReservationsStatus.textContent;
    await loadBranchReservations();
    showStatus(adminReservationsStatus, message, "success");
  } catch (error) {
    buttons.querySelectorAll("button").forEach(function (b) { b.disabled = false; });
    showStatus(adminReservationsStatus, errorText(error), "error");
  }
}

filterBranch.addEventListener("change", loadBranchReservations);
filterFrom.addEventListener("change", loadBranchReservations);
filterTo.addEventListener("change", loadBranchReservations);
filterStatus.addEventListener("change", function () { renderReservations(dayReservations); });

filterFrom.value = todayIso();
filterTo.value = todayIso();
refreshReservationBranches();
