/* =====================================================================
   ReservaYa - Panel de administración
   CRUD de restaurantes y sedes conectado al backend real via JWT.
   ===================================================================== */

if (!requireRole("RESTAURANT_ADMIN")) {
  // requireRole redirige; este bloque detiene la ejecución.
}

const dayLabels = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

const user = getUser();
const sessionLabel = document.querySelector("#session-label");
const logoutBtn = document.querySelector("#logout-button");

const form = document.querySelector("#restaurant-form");
const formStatus = document.querySelector("#form-status");
const resetButton = document.querySelector("#reset-button");
const listEmpty = document.querySelector("#list-empty");
const restaurantList = document.querySelector("#restaurant-list");

const branchesSection = document.querySelector("#branches-section");
const branchRestaurantLabel = document.querySelector("#branch-restaurant-label");
const branchForm = document.querySelector("#branch-form");
const branchFormStatus = document.querySelector("#branch-form-status");
const branchResetBtn = document.querySelector("#branch-reset-button");
const branchListEmpty = document.querySelector("#branch-list-empty");
const branchList = document.querySelector("#branch-list");
const scheduleRows = document.querySelector("#schedule-rows");

const reservationsSection = document.querySelector("#reservations-section");
const reservationsRestaurantLabel = document.querySelector("#reservations-restaurant-label");
const reservationFilterForm = document.querySelector("#reservation-filter-form");
const reservationBranch = document.querySelector("#reservation-branch");
const reservationFrom = document.querySelector("#reservation-from");
const reservationTo = document.querySelector("#reservation-to");
const reservationStatusFilter = document.querySelector("#reservation-status-filter");
const reservationsAdminStatus = document.querySelector("#reservations-admin-status");
const reservationsAdminEmpty = document.querySelector("#reservations-admin-empty");
const reservationsAdminList = document.querySelector("#reservations-admin-list");

const rInputs = {
  name: document.querySelector("#restaurant-name"),
  address: document.querySelector("#restaurant-address"),
  city: document.querySelector("#restaurant-city"),
  cuisine: document.querySelector("#restaurant-cuisine"),
  capacity: document.querySelector("#restaurant-capacity"),
};

const rErrors = {
  name: document.querySelector("#restaurant-name-error"),
  address: document.querySelector("#restaurant-address-error"),
  city: document.querySelector("#restaurant-city-error"),
  cuisine: document.querySelector("#restaurant-cuisine-error"),
  capacity: document.querySelector("#restaurant-capacity-error"),
};

const bInputs = {
  name: document.querySelector("#branch-name"),
  address: document.querySelector("#branch-address"),
  city: document.querySelector("#branch-city"),
  phone: document.querySelector("#branch-phone"),
  capacity: document.querySelector("#branch-capacity"),
};

const bErrors = {
  name: document.querySelector("#branch-name-error"),
  address: document.querySelector("#branch-address-error"),
  city: document.querySelector("#branch-city-error"),
  capacity: document.querySelector("#branch-capacity-error"),
};

const schedulesError = document.querySelector("#schedules-error");

let editingRestaurantId = null;
let restaurants = [];

let selectedRestaurant = null;
let editingBranchId = null;
let branches = [];

const reservationStatusLabels = {
  PENDING: "Pendiente",
  CONFIRMED: "Aceptada",
  REJECTED: "Rechazada",
  COMPLETED: "Completada",
  CANCELLED: "Cancelada",
};

function localDateIso() {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  return now.toISOString().slice(0, 10);
}

reservationFrom.value = localDateIso();
reservationTo.value = localDateIso();

/* ── Sesión ────────────────────────────────────────────────────────── */

sessionLabel.textContent = user.name;
logoutBtn.addEventListener("click", logout);

/* ── Utilidades ────────────────────────────────────────────────────── */

function setStatus(element, message, tone) {
  element.textContent = message || "";
  element.classList.toggle("is-error", tone === "error");
  element.classList.toggle("is-success", tone === "success");
}

/* ── Restaurantes ──────────────────────────────────────────────────── */

function validateRestaurant() {
  let valid = true;

  function check(field, message, condition) {
    if (condition) { rErrors[field].textContent = message; valid = false; }
    else { rErrors[field].textContent = ""; }
  }

  const name = rInputs.name.value.trim();
  const address = rInputs.address.value.trim();
  const city = rInputs.city.value.trim();
  const cuisine = rInputs.cuisine.value.trim();
  const capacity = Number(rInputs.capacity.value);

  check("name", "El nombre es obligatorio (mínimo 2 caracteres).", name.length < 2);
  check("address", "La dirección es obligatoria (mínimo 5 caracteres).", address.length < 5);
  check("city", "La ciudad es obligatoria.", city.length < 2);
  check("cuisine", "El tipo de cocina es obligatorio.", cuisine.length < 2);
  check("capacity", "La capacidad debe ser un número entre 1 y 500.",
    !Number.isInteger(capacity) || capacity < 1 || capacity > 500);

  return valid ? { name, description: address, cuisineType: cuisine } : null;
}

function resetRestaurantForm() {
  editingRestaurantId = null;
  form.reset();
  Object.values(rErrors).forEach(function (el) { el.textContent = ""; });
  setStatus(formStatus, "");
}

function renderRestaurantList() {
  listEmpty.hidden = restaurants.length > 0;
  restaurantList.innerHTML = "";

  restaurants.forEach(function (restaurant) {
    const item = document.createElement("li");
    item.className = "restaurant-card";
    item.innerHTML =
      '<div class="restaurant-card-head">' +
        '<h3>' + escapeHtml(restaurant.name) + '</h3>' +
        '<span class="badge">' + escapeHtml(restaurant.cuisineType) + '</span>' +
      '</div>' +
      '<p class="restaurant-address">' + escapeHtml(restaurant.description || "") + '</p>' +
      '<div class="restaurant-actions"></div>';

    const actions = item.querySelector(".restaurant-actions");

    var sedesBtn = document.createElement("button");
    sedesBtn.className = "button button-small";
    sedesBtn.type = "button";
    sedesBtn.textContent = "Gestionar sedes";
    sedesBtn.addEventListener("click", function () { selectRestaurant(restaurant); });
    actions.appendChild(sedesBtn);

    var editBtn = document.createElement("button");
    editBtn.className = "button button-small button-outline";
    editBtn.type = "button";
    editBtn.textContent = "Editar";
    editBtn.addEventListener("click", function () { editRestaurant(restaurant); });
    actions.appendChild(editBtn);

    restaurantList.appendChild(item);
  });
}

async function loadRestaurants() {
  try {
    const response = await fetch(API_BASE + "/api/restaurants?mine=true", {
      headers: authHeaders(),
    });

    if (response.status === 401) { handleUnauthorized(); return; }

    const data = await response.json();
    restaurants = Array.isArray(data) ? data : [];
    renderRestaurantList();
  } catch {
    listEmpty.hidden = false;
    setEmptyText(listEmpty, "No se pudo cargar la lista de restaurantes. Revisa que el servicio esté encendido.");
  }
}

function editRestaurant(restaurant) {
  editingRestaurantId = restaurant.id;
  rInputs.name.value = restaurant.name;
  rInputs.address.value = restaurant.description || "";
  rInputs.cuisine.value = restaurant.cuisineType;
  rInputs.city.value = "";
  rInputs.capacity.value = "";
  Object.values(rErrors).forEach(function (el) { el.textContent = ""; });
  setStatus(formStatus, "Editando: " + restaurant.name);
  form.scrollIntoView({ behavior: "smooth", block: "start" });
}

form.addEventListener("submit", async function (event) {
  event.preventDefault();
  setStatus(formStatus, "");

  const payload = validateRestaurant();
  if (!payload) return;

  const endpoint = editingRestaurantId
    ? API_BASE + "/api/restaurants/" + editingRestaurantId
    : API_BASE + "/api/restaurants";

  try {
    const response = await fetch(endpoint, {
      method: editingRestaurantId ? "PUT" : "POST",
      headers: authHeaders(),
      body: JSON.stringify(payload),
    });

    if (response.status === 401) { handleUnauthorized(); return; }

    if (!response.ok) {
      const result = await response.json().catch(function () { return {}; });
      setStatus(formStatus, result.message || "No se pudo guardar el restaurante.", "error");
      return;
    }

    setStatus(formStatus,
      editingRestaurantId ? "Restaurante actualizado." : "Restaurante registrado.", "success");

    if (!editingRestaurantId) resetRestaurantForm();
    await loadRestaurants();
  } catch {
    setStatus(formStatus, "No se pudo conectar con el servidor.", "error");
  }
});

resetButton.addEventListener("click", resetRestaurantForm);

/* ── Sedes (Branches) ─────────────────────────────────────────────── */

function selectRestaurant(restaurant) {
  selectedRestaurant = restaurant;
  branchesSection.hidden = false;
  branchRestaurantLabel.textContent = "Sedes de: " + restaurant.name;
  resetBranchForm();
  reservationsSection.hidden = false;
  reservationsRestaurantLabel.textContent = "Reservas de: " + restaurant.name;
  loadBranches();
  branchesSection.scrollIntoView({ behavior: "smooth", block: "start" });
}

function buildScheduleRows(entries) {
  scheduleRows.innerHTML = "";

  dayLabels.forEach(function (label, index) {
    const entry = entries ? entries[index] : null;
    const open = entry ? entry.openTime || entry.open || "12:00" : "12:00";
    const close = entry ? entry.closeTime || entry.close || "22:00" : "22:00";
    const closed = entry ? (entry.isClosed !== undefined ? entry.isClosed : entry.closed || false) : false;

    const row = document.createElement("div");
    row.className = "schedule-row";
    row.innerHTML =
      '<span class="schedule-day">' + label + '</span>' +
      '<label class="schedule-toggle">' +
        '<input type="checkbox" class="schedule-closed" ' + (closed ? "checked" : "") + ' /> Cerrado' +
      '</label>' +
      '<label class="schedule-time-field">Desde' +
        '<input type="time" class="schedule-open" value="' + open + '" />' +
      '</label>' +
      '<label class="schedule-time-field">Hasta' +
        '<input type="time" class="schedule-close" value="' + close + '" />' +
      '</label>';

    const checkbox = row.querySelector(".schedule-closed");
    const openInput = row.querySelector(".schedule-open");
    const closeInput = row.querySelector(".schedule-close");

    function syncDisabled() {
      openInput.disabled = checkbox.checked;
      closeInput.disabled = checkbox.checked;
    }
    checkbox.addEventListener("change", syncDisabled);
    syncDisabled();

    scheduleRows.appendChild(row);
  });
}

function collectSchedules() {
  return Array.from(scheduleRows.querySelectorAll(".schedule-row")).map(function (row, index) {
    return {
      dayOfWeek: index + 1,
      openTime: row.querySelector(".schedule-open").value,
      closeTime: row.querySelector(".schedule-close").value,
      isClosed: row.querySelector(".schedule-closed").checked,
    };
  });
}

function validateBranch() {
  let valid = true;

  function check(field, message, condition) {
    if (condition) { bErrors[field].textContent = message; valid = false; }
    else { bErrors[field].textContent = ""; }
  }

  const name = bInputs.name.value.trim();
  const address = bInputs.address.value.trim();
  const city = bInputs.city.value.trim();
  const phone = bInputs.phone.value.trim();
  const capacity = Number(bInputs.capacity.value);

  check("name", "El nombre de la sede es obligatorio.", name.length < 2);
  check("address", "La dirección es obligatoria.", address.length < 5);
  check("city", "La ciudad es obligatoria.", city.length < 2);
  check("capacity", "La capacidad debe ser entre 1 y 500.",
    !Number.isInteger(capacity) || capacity < 1 || capacity > 500);

  const schedules = collectSchedules();
  let scheduleError = "";

  if (schedules.every(function (e) { return e.isClosed; })) {
    scheduleError = "Debe haber al menos un día abierto.";
  } else {
    for (const entry of schedules) {
      if (entry.isClosed) continue;
      if (!entry.openTime || !entry.closeTime) {
        scheduleError = "Completa los horarios del " + dayLabels[entry.dayOfWeek - 1] + ".";
        break;
      }
      if (entry.openTime >= entry.closeTime) {
        scheduleError = "Horario inválido el " + dayLabels[entry.dayOfWeek - 1] + ": apertura debe ser antes del cierre.";
        break;
      }
    }
  }

  if (scheduleError) { schedulesError.textContent = scheduleError; valid = false; }
  else { schedulesError.textContent = ""; }

  return valid ? { name, address, city, phone: phone || null, capacity, schedules } : null;
}

function resetBranchForm() {
  editingBranchId = null;
  branchForm.reset();
  Object.values(bErrors).forEach(function (el) { el.textContent = ""; });
  schedulesError.textContent = "";
  setStatus(branchFormStatus, "");
  buildScheduleRows(null);
}

function renderBranchList() {
  branchListEmpty.hidden = branches.length > 0;
  branchList.innerHTML = "";

  branches.forEach(function (branch) {
    const item = document.createElement("li");
    item.className = "restaurant-card";

    const scheduleSummary = branch.schedules
      ? branch.schedules
          .filter(function (s) { return !s.isClosed; })
          .map(function (s) { return dayLabels[s.dayOfWeek - 1]; })
          .join(", ") || "Sin días abiertos"
      : "";

    item.innerHTML =
      '<div class="restaurant-card-head">' +
        '<h3>' + escapeHtml(branch.name) + '</h3>' +
        '<span class="badge ' + (branch.active ? 'badge-ok">Activa' : 'badge-off">Inactiva') + '</span>' +
      '</div>' +
      '<p class="restaurant-address">' + escapeHtml(branch.address) + ', ' + escapeHtml(branch.city) + '</p>' +
      '<p class="restaurant-meta">Capacidad: ' + branch.capacity + ' personas</p>' +
      (scheduleSummary ? '<p class="restaurant-meta">Atención: ' + escapeHtml(scheduleSummary) + '</p>' : '') +
      '<div class="restaurant-actions"></div>';

    const actions = item.querySelector(".restaurant-actions");

    var editBtn = document.createElement("button");
    editBtn.className = "button button-small button-outline";
    editBtn.type = "button";
    editBtn.textContent = "Editar";
    editBtn.addEventListener("click", function () { editBranch(branch); });
    actions.appendChild(editBtn);

    branchList.appendChild(item);
  });
}

function populateReservationBranches() {
  const previousBranchId = reservationBranch.value;
  reservationBranch.innerHTML = "";

  branches.forEach(function (branch) {
    const option = document.createElement("option");
    option.value = String(branch.id);
    option.textContent = branch.name;
    reservationBranch.appendChild(option);
  });

  if (branches.some(function (branch) { return String(branch.id) === previousBranchId; })) {
    reservationBranch.value = previousBranchId;
  }
  reservationFilterForm.querySelector("button[type=submit]").disabled = branches.length === 0;
  reservationsAdminEmpty.hidden = branches.length > 0;
  reservationsAdminList.innerHTML = "";
  if (branches.length > 0) loadAdminReservations();
}

const reservationStatusStyles = {
  PENDING: "badge-warn",
  CONFIRMED: "badge-ok",
  REJECTED: "badge-alert",
  CANCELLED: "badge-alert",
  COMPLETED: "badge-off",
};

function reservationCard(reservation) {
  const item = document.createElement("li");
  item.className = "restaurant-card";
  const time = reservation.reservationTime ? reservation.reservationTime.substring(0, 5) : "";
  item.innerHTML =
    '<div class="restaurant-card-head">' +
      '<h3>' + escapeHtml(reservation.customerEmail || "Cliente #" + reservation.userId) + '</h3>' +
      '<span class="badge ' + (reservationStatusStyles[reservation.status] || "") + '">' +
        escapeHtml(reservationStatusLabels[reservation.status] || reservation.status) +
      '</span>' +
    '</div>' +
    '<p class="restaurant-address">' + escapeHtml(reservation.reservationDate) +
      ' · ' + escapeHtml(time) + '</p>' +
    '<p class="restaurant-meta">' + reservation.partySize +
      (reservation.partySize === 1 ? ' persona · ' : ' personas · ') +
      'Reserva #' + reservation.id + '</p>';

  const actions = document.createElement("div");
  actions.className = "restaurant-actions";
  const choices = reservation.status === "PENDING"
    ? [{ status: "CONFIRMED", label: "Aceptar", className: "button button-small" },
       { status: "REJECTED", label: "Rechazar", className: "button button-small button-danger" }]
    : reservation.status === "CONFIRMED"
      ? [{ status: "COMPLETED", label: "Marcar completada", className: "button button-small button-outline" }]
      : [];

  choices.forEach(function (choice) {
    const button = document.createElement("button");
    button.className = choice.className;
    button.type = "button";
    button.textContent = choice.label;
    button.addEventListener("click", function () {
      changeReservationStatus(reservation, choice.status);
    });
    actions.appendChild(button);
  });
  item.appendChild(actions);
  return item;
}

async function loadAdminReservations() {
  if (!reservationBranch.value) return;
  const params = new URLSearchParams({ branchId: reservationBranch.value });
  if (reservationFrom.value) params.set("from", reservationFrom.value);
  if (reservationTo.value) params.set("to", reservationTo.value);
  if (reservationStatusFilter.value) params.set("status", reservationStatusFilter.value);

  setStatus(reservationsAdminStatus, "Cargando reservas...");
  reservationsAdminEmpty.hidden = true;
  try {
    const response = await fetch(API_BASE + "/api/reservations?" + params, {
      headers: authHeaders(),
    });
    if (response.status === 401) { handleUnauthorized(); return; }
    const data = await response.json().catch(function () { return []; });
    if (!response.ok) {
      setStatus(reservationsAdminStatus, data.message || "No se pudieron cargar las reservas.", "error");
      return;
    }

    reservationsAdminList.innerHTML = "";
    const reservations = Array.isArray(data) ? data : [];
    reservationsAdminEmpty.hidden = reservations.length > 0;
    reservations.forEach(function (reservation) {
      reservationsAdminList.appendChild(reservationCard(reservation));
    });
    setStatus(reservationsAdminStatus, reservations.length
      ? reservations.length + (reservations.length === 1 ? " reserva encontrada." : " reservas encontradas.")
      : "");
  } catch {
    setStatus(reservationsAdminStatus, "No se pudo conectar con el servicio de reservas.", "error");
  }
}

async function changeReservationStatus(reservation, status) {
  try {
    const response = await fetch(API_BASE + "/api/reservations/" + reservation.id + "/status", {
      method: "PATCH",
      headers: authHeaders(),
      body: JSON.stringify({ status }),
    });
    if (response.status === 401) { handleUnauthorized(); return; }
    const data = await response.json().catch(function () { return {}; });
    if (!response.ok) {
      setStatus(reservationsAdminStatus, data.message || "No se pudo actualizar el estado.", "error");
      return;
    }
    await loadAdminReservations();
    setStatus(reservationsAdminStatus,
      "Reserva actualizada. Se notificó al cliente si hay correo configurado.", "success");
  } catch {
    setStatus(reservationsAdminStatus, "No se pudo conectar con el servidor.", "error");
  }
}

reservationFilterForm.addEventListener("submit", function (event) {
  event.preventDefault();
  loadAdminReservations();
});

async function loadBranches() {
  if (!selectedRestaurant) return;

  try {
    const response = await fetch(
      API_BASE + "/api/restaurants/" + selectedRestaurant.id + "/branches",
      { headers: authHeaders() }
    );

    if (response.status === 401) { handleUnauthorized(); return; }

    const data = await response.json();
    branches = Array.isArray(data) ? data : [];
    renderBranchList();
    populateReservationBranches();
  } catch {
    branchListEmpty.hidden = false;
    setEmptyText(branchListEmpty, "No se pudieron cargar las sedes. Revisa que el servicio esté encendido.");
  }
}

function editBranch(branch) {
  editingBranchId = branch.id;
  bInputs.name.value = branch.name;
  bInputs.address.value = branch.address;
  bInputs.city.value = branch.city;
  bInputs.phone.value = branch.phone || "";
  bInputs.capacity.value = branch.capacity;

  if (branch.schedules && branch.schedules.length > 0) {
    const sorted = branch.schedules.slice().sort(function (a, b) { return a.dayOfWeek - b.dayOfWeek; });
    buildScheduleRows(sorted);
  } else {
    buildScheduleRows(null);
  }

  Object.values(bErrors).forEach(function (el) { el.textContent = ""; });
  schedulesError.textContent = "";
  setStatus(branchFormStatus, "Editando: " + branch.name);
  branchForm.scrollIntoView({ behavior: "smooth", block: "start" });
}

branchForm.addEventListener("submit", async function (event) {
  event.preventDefault();
  setStatus(branchFormStatus, "");

  const payload = validateBranch();
  if (!payload) return;

  const endpoint = editingBranchId
    ? API_BASE + "/api/restaurants/" + selectedRestaurant.id + "/branches/" + editingBranchId
    : API_BASE + "/api/restaurants/" + selectedRestaurant.id + "/branches";

  try {
    const response = await fetch(endpoint, {
      method: editingBranchId ? "PUT" : "POST",
      headers: authHeaders(),
      body: JSON.stringify(payload),
    });

    if (response.status === 401) { handleUnauthorized(); return; }

    if (!response.ok) {
      const result = await response.json().catch(function () { return {}; });
      setStatus(branchFormStatus, result.message || "No se pudo guardar la sede.", "error");
      return;
    }

    setStatus(branchFormStatus,
      editingBranchId ? "Sede actualizada." : "Sede registrada.", "success");

    if (!editingBranchId) resetBranchForm();
    await loadBranches();
  } catch {
    setStatus(branchFormStatus, "No se pudo conectar con el servidor.", "error");
  }
});

branchResetBtn.addEventListener("click", resetBranchForm);

/* ── Inicializacion ────────────────────────────────────────────────── */

buildScheduleRows(null);
loadRestaurants();
