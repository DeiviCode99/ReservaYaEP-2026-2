/* =====================================================================
   ReservaYa - Nueva reserva y modificación (panel del cliente)
   RNF-01: la reserva se completa en dos pasos.
     1. Buscar y elegir sede (RF-04 / HU-03).
     2. Fecha, hora con cupo y personas, y confirmar (RF-05, RF-06).
   RF-09: "Modificar" en una reserva activa reabre el paso 2 con sus datos.
   Usa auth.js (apiFetch, showStatus, formatDate, todayIso, CITIES) y
   cliente.js (loadReservations).
   ===================================================================== */

const searchForm = document.querySelector("#search-form");
const searchStatus = document.querySelector("#search-status");
const branchResults = document.querySelector("#branch-results");
const reservationForm = document.querySelector("#reservation-form");
const step2Title = document.querySelector("#step2-title");
const selectedBranchText = document.querySelector("#selected-branch");
const reservationDate = document.querySelector("#reservation-date");
const partySize = document.querySelector("#party-size");
const depositNote = document.querySelector("#deposit-note");
const slotList = document.querySelector("#slot-list");
const slotStatus = document.querySelector("#slot-status");
const reservationStatus = document.querySelector("#reservation-status");
const confirmButton = reservationForm.querySelector("button[type=submit]");
const cancelEditButton = document.querySelector("#cancel-edit");

let chosenBranch = null;
let chosenSlot = null;
let editing = null; // reserva que se está modificando (RF-09), o null
// Solo pinta la respuesta de la última consulta, aunque lleguen desordenadas.
let searchRequest = 0;
let slotsRequest = 0;

// Las ciudades del filtro salen de la misma lista que usa el administrador.
CITIES.forEach(function (city) {
  document.querySelector("#search-city").add(new Option(city, city));
});

/* -- Paso 1: buscar y elegir sede ----------------------------------- */

function branchCard(branch) {
  const li = document.createElement("li");
  li.className = "restaurant-card";
  li.innerHTML =
    "<h3>" + escapeHtml(branch.restaurantName) + "</h3>" +
    '<p class="restaurant-address">' + escapeHtml(branch.name) + " · " +
      escapeHtml(branch.address) + ", " + escapeHtml(branch.city) + "</p>" +
    '<p class="restaurant-meta">Cocina ' + escapeHtml(branch.cuisineType) +
      " · aforo " + branch.capacity + " personas por franja</p>";

  const actions = document.createElement("div");
  actions.className = "restaurant-actions";
  const button = document.createElement("button");
  button.className = "button button-small";
  button.type = "button";
  button.textContent = "Reservar aquí";
  button.addEventListener("click", function () {
    stopEditing();
    chooseBranch(branch);
  });
  actions.appendChild(button);
  li.appendChild(actions);
  return li;
}

async function searchBranches() {
  if (!editing) reservationForm.hidden = true;
  branchResults.innerHTML = "";

  // Solo se envían los campos llenos; un filtro ausente no filtra.
  const params = new URLSearchParams();
  const filters = {
    name: document.querySelector("#search-name").value.trim(),
    city: document.querySelector("#search-city").value,
    cuisine: document.querySelector("#search-cuisine").value.trim(),
  };
  Object.keys(filters).forEach(function (key) {
    if (filters[key]) params.set(key, filters[key]);
  });

  const request = ++searchRequest;
  showStatus(searchStatus, "Buscando sedes...");
  try {
    // Una sola consulta: sedes activas con su restaurante y tipo de cocina.
    const branches = await apiFetch("/api/restaurants/branches?" + params);
    if (request !== searchRequest) return;

    if (branches.length === 0) {
      showStatus(searchStatus, "No encontramos sedes con esos filtros. Prueba con otros.", "error");
      return;
    }
    showStatus(searchStatus, branches.length + (branches.length === 1 ? " sede encontrada." : " sedes encontradas."), "success");
    branches.forEach(function (branch) { branchResults.appendChild(branchCard(branch)); });
  } catch (error) {
    if (request === searchRequest) showStatus(searchStatus, errorText(error), "error");
  }
}

searchForm.addEventListener("submit", function (event) {
  event.preventDefault();
  searchBranches();
});
document.querySelector("#search-city").addEventListener("change", searchBranches);

function chooseBranch(branch) {
  chosenBranch = branch;
  selectedBranchText.textContent = branch.restaurantName + " · " + branch.name + " (" +
    branch.address + ", " + branch.city + ")";
  showStatus(reservationStatus, "");
  reservationForm.hidden = false;
  reservationForm.scrollIntoView({ behavior: "smooth", block: "start" });
  loadSlots();
}

/* -- Paso 2: horarios con cupo, personas y confirmación -------------- */

async function loadSlots() {
  chosenSlot = null;
  confirmButton.disabled = true;
  slotList.innerHTML = "";
  if (!reservationDate.value || reservationDate.value < todayIso()) {
    showStatus(slotStatus, "Elige una fecha de hoy en adelante.", "error");
    return;
  }

  const request = ++slotsRequest;
  showStatus(slotStatus, "Consultando disponibilidad...");
  try {
    const data = await apiFetch("/api/reservations/availability?branchId=" + chosenBranch.id +
      "&date=" + reservationDate.value);
    if (request !== slotsRequest) return;

    // Al modificar, los puestos de la propia reserva cuentan como libres.
    if (editing && editing.branchId === chosenBranch.id && editing.reservationDate === reservationDate.value) {
      data.slots.forEach(function (slot) {
        if (slot.time === editing.reservationTime) slot.available += editing.partySize;
      });
    }

    // HU-04: solo se muestran las franjas con cupo.
    const open = data.slots.filter(function (slot) { return slot.available > 0; });
    if (open.length === 0) {
      showStatus(slotStatus, data.slots.length === 0
        ? "La sede no atiende ese día (o ya pasaron sus horarios). Prueba con otra fecha."
        : "No hay disponibilidad ese día: todas las franjas están llenas.", "error");
      return;
    }
    showStatus(slotStatus, "");
    open.forEach(function (slot) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "slot-button";
      button.setAttribute("aria-pressed", "false");
      button.innerHTML = "<strong>" + slot.time.substring(0, 5) + "</strong>" +
        "<small>" + slot.available + (slot.available === 1 ? " cupo" : " cupos") + "</small>";
      button.addEventListener("click", function () { chooseSlot(slot, button); });
      slotList.appendChild(button);
      if (editing && slot.time === editing.reservationTime && reservationDate.value === editing.reservationDate) {
        chooseSlot(slot, button);
      }
    });
  } catch (error) {
    if (request === slotsRequest) showStatus(slotStatus, errorText(error), "error");
  }
}

function chooseSlot(slot, button) {
  chosenSlot = slot;
  slotList.querySelectorAll(".slot-button").forEach(function (b) {
    b.setAttribute("aria-pressed", String(b === button));
  });
  partySize.max = String(Math.min(slot.available, 50));
  if (Number(partySize.value) > slot.available) partySize.value = String(slot.available);
  updateDepositNote();
  confirmButton.disabled = false;
  showStatus(reservationStatus, formatDate(reservationDate.value) + " a las " +
    slot.time.substring(0, 5) + " en " + chosenBranch.name + ".");
}

/* Regla del Sprint 2: abono de $50.000 hasta 3 personas, $100.000 desde 4.
   ponytail: solo informativo, el backend aún no registra el abono. */
function updateDepositNote() {
  const amount = Number(partySize.value) <= 3 ? 50000 : 100000;
  depositNote.textContent = "Abono requerido: " + amount.toLocaleString("es-CO", {
    style: "currency", currency: "COP", maximumFractionDigits: 0,
  });
}

reservationDate.min = todayIso();
reservationDate.value = todayIso();
reservationDate.addEventListener("change", loadSlots);
partySize.addEventListener("input", updateDepositNote);
updateDepositNote();

/* -- Modificar una reserva existente (RF-09) ------------------------- */

/* Lo llama el botón "Modificar" de cliente.js. */
async function editReservation(reservation) {
  try {
    const branch = await apiFetch("/api/restaurants/branches/" + reservation.branchId);
    editing = reservation;
    step2Title.textContent = "Modificar reserva #" + reservation.id;
    confirmButton.textContent = "Guardar cambios";
    cancelEditButton.hidden = false;
    reservationDate.value = reservation.reservationDate < todayIso() ? todayIso() : reservation.reservationDate;
    partySize.value = String(reservation.partySize);
    chooseBranch(branch);
  } catch (error) {
    alert(errorText(error));
  }
}

function stopEditing() {
  editing = null;
  step2Title.textContent = "Día, hora y personas";
  confirmButton.textContent = "Confirmar reserva";
  cancelEditButton.hidden = true;
}

cancelEditButton.addEventListener("click", function () {
  stopEditing();
  reservationForm.hidden = true;
});

reservationForm.addEventListener("submit", async function (event) {
  event.preventDefault();
  if (!chosenSlot) {
    showStatus(reservationStatus, "Elige un horario con cupo.", "error");
    return;
  }
  const people = Number(partySize.value);
  if (!Number.isInteger(people) || people < 1 || people > chosenSlot.available) {
    showStatus(reservationStatus, "Este horario admite entre 1 y " + chosenSlot.available + " personas.", "error");
    return;
  }

  confirmButton.disabled = true;
  showStatus(reservationStatus, editing ? "Guardando cambios..." : "Confirmando reserva...");
  try {
    const reservation = await apiFetch(editing ? "/api/reservations/" + editing.id : "/api/reservations", {
      method: editing ? "PUT" : "POST",
      body: JSON.stringify({
        branchId: chosenBranch.id,
        reservationDate: reservationDate.value,
        reservationTime: chosenSlot.time,
        partySize: people,
      }),
    });
    showStatus(reservationStatus,
      "Reserva #" + reservation.id + (editing ? " modificada" : " creada") + " para " + people +
      " persona(s). Queda pendiente hasta que el restaurante la confirme.", "success");
    stopEditing();
    loadReservations();
  } catch (error) {
    showStatus(reservationStatus, errorText(error), "error");
  } finally {
    // Los cupos cambiaron (por esta reserva o por otra): se vuelven a pedir.
    const message = reservationStatus.textContent;
    const ok = reservationStatus.classList.contains("is-success");
    await loadSlots();
    showStatus(reservationStatus, message, ok ? "success" : "error");
  }
});

searchBranches();
