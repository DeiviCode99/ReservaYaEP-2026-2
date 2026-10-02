/* =====================================================================
   ReservaYa - Panel de administración: restaurantes y sedes (RF-03, RF-13)
   Las reservas de las sedes están en admin-reservas.js.
   Usa auth.js (apiFetch, showStatus, errorText, escapeHtml, CITIES).
   ===================================================================== */

if (!requireRole("RESTAURANT_ADMIN")) {
  // requireRole redirige; este bloque detiene la ejecución.
}

const dayLabels = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

const user = getUser();
document.querySelector("#session-label").textContent = user.name;
document.querySelector("#logout-button").addEventListener("click", logout);

const form = document.querySelector("#restaurant-form");
const formStatus = document.querySelector("#form-status");
const listEmpty = document.querySelector("#list-empty");
const restaurantList = document.querySelector("#restaurant-list");

const branchesSection = document.querySelector("#branches-section");
const branchRestaurantLabel = document.querySelector("#branch-restaurant-label");
const branchForm = document.querySelector("#branch-form");
const branchFormStatus = document.querySelector("#branch-form-status");
const branchListEmpty = document.querySelector("#branch-list-empty");
const branchList = document.querySelector("#branch-list");
const scheduleRows = document.querySelector("#schedule-rows");
const schedulesError = document.querySelector("#schedules-error");

const rInputs = {
  name: document.querySelector("#restaurant-name"),
  cuisine: document.querySelector("#restaurant-cuisine"),
  description: document.querySelector("#restaurant-description"),
};

const rErrors = {
  name: document.querySelector("#restaurant-name-error"),
  cuisine: document.querySelector("#restaurant-cuisine-error"),
};

const bInputs = {
  name: document.querySelector("#branch-name"),
  address: document.querySelector("#branch-address"),
  city: document.querySelector("#branch-city"),
  phone: document.querySelector("#branch-phone"),
  capacity: document.querySelector("#branch-capacity"),
  active: document.querySelector("#branch-active"),
};

const bErrors = {
  name: document.querySelector("#branch-name-error"),
  address: document.querySelector("#branch-address-error"),
  city: document.querySelector("#branch-city-error"),
  capacity: document.querySelector("#branch-capacity-error"),
};

CITIES.forEach(function (city) { bInputs.city.add(new Option(city, city)); });

let restaurants = [];
let editingRestaurantId = null;
let selectedRestaurant = null;
let branches = [];
let editingBranchId = null;

/* ── Utilidades ────────────────────────────────────────────────────── */

/* Marca o limpia el error de cada campo; devuelve true si no hubo errores. */
function applyChecks(errors, checks) {
  let valid = true;
  checks.forEach(function (check) {
    const [field, message, failed] = check;
    errors[field].textContent = failed ? message : "";
    if (failed) valid = false;
  });
  return valid;
}

function clearErrors(errors) {
  Object.values(errors).forEach(function (el) { el.textContent = ""; });
}

function actionButton(text, style, onClick) {
  const button = document.createElement("button");
  button.className = "button button-small " + style;
  button.type = "button";
  button.textContent = text;
  button.addEventListener("click", onClick);
  return button;
}

/* Las sedes nuevas o editadas deben aparecer en el filtro de reservas. */
function notifyBranchesChanged() {
  if (typeof refreshReservationBranches === "function") refreshReservationBranches();
}

/* ── Restaurantes ──────────────────────────────────────────────────── */

function validateRestaurant() {
  const name = rInputs.name.value.trim();
  const cuisineType = rInputs.cuisine.value.trim();
  const description = rInputs.description.value.trim();

  const valid = applyChecks(rErrors, [
    ["name", "El nombre es obligatorio (mínimo 2 caracteres).", name.length < 2],
    ["cuisine", "El tipo de cocina es obligatorio.", cuisineType.length < 2],
  ]);
  return valid ? { name: name, cuisineType: cuisineType, description: description || null } : null;
}

function resetRestaurantForm() {
  editingRestaurantId = null;
  form.reset();
  clearErrors(rErrors);
  showStatus(formStatus, "");
}

function renderRestaurantList() {
  listEmpty.hidden = restaurants.length > 0;
  restaurantList.innerHTML = "";

  restaurants.forEach(function (restaurant) {
    const item = document.createElement("li");
    item.className = "restaurant-card";
    item.innerHTML =
      "<h3>" + escapeHtml(restaurant.name) + "</h3>" +
      '<p class="restaurant-meta">Cocina ' + escapeHtml(restaurant.cuisineType) + "</p>" +
      (restaurant.description
        ? '<p class="restaurant-address">' + escapeHtml(restaurant.description) + "</p>"
        : "");

    const actions = document.createElement("div");
    actions.className = "restaurant-actions";
    actions.appendChild(actionButton("Gestionar sedes", "", function () { selectRestaurant(restaurant); }));
    actions.appendChild(actionButton("Editar", "button-outline", function () { editRestaurant(restaurant); }));
    item.appendChild(actions);
    restaurantList.appendChild(item);
  });
}

async function loadRestaurants() {
  try {
    restaurants = await apiFetch("/api/restaurants?mine=true");
    renderRestaurantList();
  } catch (error) {
    listEmpty.hidden = false;
    setEmptyText(listEmpty, errorText(error));
  }
}

function editRestaurant(restaurant) {
  editingRestaurantId = restaurant.id;
  rInputs.name.value = restaurant.name;
  rInputs.cuisine.value = restaurant.cuisineType;
  rInputs.description.value = restaurant.description || "";
  clearErrors(rErrors);
  showStatus(formStatus, "Editando: " + restaurant.name);
  form.scrollIntoView({ behavior: "smooth", block: "start" });
}

form.addEventListener("submit", async function (event) {
  event.preventDefault();
  showStatus(formStatus, "");

  const payload = validateRestaurant();
  if (!payload) return;

  const wasEditing = editingRestaurantId !== null;
  try {
    await apiFetch(wasEditing ? "/api/restaurants/" + editingRestaurantId : "/api/restaurants", {
      method: wasEditing ? "PUT" : "POST",
      body: JSON.stringify(payload),
    });
    if (!wasEditing) resetRestaurantForm();
    showStatus(formStatus, wasEditing ? "Restaurante actualizado." : "Restaurante registrado.", "success");
    await loadRestaurants();
    notifyBranchesChanged();
  } catch (error) {
    showStatus(formStatus, errorText(error), "error");
  }
});

document.querySelector("#reset-button").addEventListener("click", resetRestaurantForm);

/* ── Sedes ─────────────────────────────────────────────────────────── */

function selectRestaurant(restaurant) {
  selectedRestaurant = restaurant;
  branchesSection.hidden = false;
  branchRestaurantLabel.textContent = "Sedes de: " + restaurant.name;
  resetBranchForm();
  loadBranches();
  branchesSection.scrollIntoView({ behavior: "smooth", block: "start" });
}

function buildScheduleRows(entries) {
  scheduleRows.innerHTML = "";

  dayLabels.forEach(function (label, index) {
    const entry = entries ? entries.find(function (e) { return e.dayOfWeek === index + 1; }) : null;
    const open = entry && entry.openTime ? entry.openTime.substring(0, 5) : "12:00";
    const close = entry && entry.closeTime ? entry.closeTime.substring(0, 5) : "22:00";
    const closed = entry ? Boolean(entry.isClosed) : false;

    const row = document.createElement("div");
    row.className = "schedule-row";
    row.innerHTML =
      '<span class="schedule-day">' + label + "</span>" +
      '<label class="schedule-toggle">' +
        '<input type="checkbox" class="schedule-closed" ' + (closed ? "checked" : "") + " /> Cerrado" +
      "</label>" +
      '<label class="schedule-time-field">Desde' +
        '<input type="time" class="schedule-open" value="' + open + '" />' +
      "</label>" +
      '<label class="schedule-time-field">Hasta' +
        '<input type="time" class="schedule-close" value="' + close + '" />' +
      "</label>";

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

/* Mensaje del primer día con horario inválido, o "" si todos están bien. */
function scheduleProblem(schedules) {
  if (schedules.every(function (e) { return e.isClosed; })) return "Debe haber al menos un día abierto.";
  for (const entry of schedules) {
    if (entry.isClosed) continue;
    const day = dayLabels[entry.dayOfWeek - 1];
    if (!entry.openTime || !entry.closeTime) return "Completa los horarios del " + day + ".";
    if (entry.openTime >= entry.closeTime) {
      return "Horario inválido el " + day + ": la apertura debe ser antes del cierre.";
    }
  }
  return "";
}

function validateBranch() {
  const name = bInputs.name.value.trim();
  const address = bInputs.address.value.trim();
  const city = bInputs.city.value;
  const phone = bInputs.phone.value.trim();
  const capacity = Number(bInputs.capacity.value);

  const fieldsValid = applyChecks(bErrors, [
    ["name", "El nombre de la sede es obligatorio.", name.length < 2],
    ["address", "La dirección es obligatoria (mínimo 5 caracteres).", address.length < 5],
    ["city", "Elige la ciudad de la sede.", !CITIES.includes(city)],
    ["capacity", "La capacidad debe ser un número entre 1 y 500.",
      !Number.isInteger(capacity) || capacity < 1 || capacity > 500],
  ]);

  const schedules = collectSchedules();
  schedulesError.textContent = scheduleProblem(schedules);

  if (!fieldsValid || schedulesError.textContent) return null;
  return {
    name: name,
    address: address,
    city: city,
    phone: phone || null,
    capacity: capacity,
    // Siempre se envía: si faltara, el backend la reactivaría al editar.
    active: bInputs.active.checked,
    schedules: schedules,
  };
}

function resetBranchForm() {
  editingBranchId = null;
  branchForm.reset();
  clearErrors(bErrors);
  schedulesError.textContent = "";
  showStatus(branchFormStatus, "");
  buildScheduleRows(null);
}

function scheduleSummary(branch) {
  const open = (branch.schedules || [])
    .filter(function (s) { return !s.isClosed; })
    .sort(function (a, b) { return a.dayOfWeek - b.dayOfWeek; })
    .map(function (s) { return dayLabels[s.dayOfWeek - 1]; });
  return open.length ? open.join(", ") : "Sin días abiertos";
}

function renderBranchList() {
  branchListEmpty.hidden = branches.length > 0;
  branchList.innerHTML = "";

  branches.forEach(function (branch) {
    const item = document.createElement("li");
    item.className = "restaurant-card";
    item.innerHTML =
      '<div class="restaurant-card-head">' +
        "<h3>" + escapeHtml(branch.name) + "</h3>" +
        '<span class="badge ' + (branch.active ? "badge-ok" : "badge-off") + '">' +
          (branch.active ? "Activa" : "Inactiva") + "</span>" +
      "</div>" +
      '<p class="restaurant-address">' + escapeHtml(branch.address) + ", " + escapeHtml(branch.city) + "</p>" +
      '<p class="restaurant-meta">Capacidad: ' + branch.capacity + " personas por franja</p>" +
      '<p class="restaurant-meta">Atiende: ' + escapeHtml(scheduleSummary(branch)) + "</p>";

    const actions = document.createElement("div");
    actions.className = "restaurant-actions";
    actions.appendChild(actionButton("Editar", "button-outline", function () { editBranch(branch); }));
    item.appendChild(actions);
    branchList.appendChild(item);
  });
}

async function loadBranches() {
  if (!selectedRestaurant) return;
  try {
    branches = await apiFetch("/api/restaurants/" + selectedRestaurant.id + "/branches");
    renderBranchList();
  } catch (error) {
    branchListEmpty.hidden = false;
    setEmptyText(branchListEmpty, errorText(error));
  }
}

function editBranch(branch) {
  editingBranchId = branch.id;
  bInputs.name.value = branch.name;
  bInputs.address.value = branch.address;
  // Una ciudad escrita a mano antes (ej. "Giron") no está en la lista:
  // el select queda vacío y la validación pide elegirla de nuevo.
  bInputs.city.value = CITIES.includes(branch.city) ? branch.city : "";
  bInputs.phone.value = branch.phone || "";
  bInputs.capacity.value = branch.capacity;
  bInputs.active.checked = branch.active !== false;
  buildScheduleRows(branch.schedules && branch.schedules.length ? branch.schedules : null);

  clearErrors(bErrors);
  schedulesError.textContent = "";
  showStatus(branchFormStatus, "Editando: " + branch.name);
  branchForm.scrollIntoView({ behavior: "smooth", block: "start" });
}

branchForm.addEventListener("submit", async function (event) {
  event.preventDefault();
  showStatus(branchFormStatus, "");

  const payload = validateBranch();
  if (!payload) return;

  const base = "/api/restaurants/" + selectedRestaurant.id + "/branches";
  const wasEditing = editingBranchId !== null;
  try {
    await apiFetch(wasEditing ? base + "/" + editingBranchId : base, {
      method: wasEditing ? "PUT" : "POST",
      body: JSON.stringify(payload),
    });
    if (!wasEditing) resetBranchForm();
    showStatus(branchFormStatus, wasEditing ? "Sede actualizada." : "Sede registrada.", "success");
    await loadBranches();
    notifyBranchesChanged();
  } catch (error) {
    showStatus(branchFormStatus, errorText(error), "error");
  }
});

document.querySelector("#branch-reset-button").addEventListener("click", resetBranchForm);

/* ── Inicio ────────────────────────────────────────────────────────── */

buildScheduleRows(null);
loadRestaurants();
