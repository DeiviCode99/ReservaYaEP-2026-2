const sessionKey = "reservaya.user";
const customerSession = document.querySelector("#customer-session");
const searchForm = document.querySelector("#locations-search-form");
const locationFilter = document.querySelector("#location-filter");
const cuisineFilter = document.querySelector("#cuisine-filter");
const locationsStatus = document.querySelector("#locations-status");
const resultsCount = document.querySelector("#results-count");
const results = document.querySelector("#location-results");
const pagination = document.querySelector("#pagination");
const reservationPanel = document.querySelector("#reservation-panel");
const selectedLocation = document.querySelector("#selected-location");
const availabilityForm = document.querySelector("#availability-form");
const reservationDate = document.querySelector("#reservation-date");
const slotList = document.querySelector("#slot-list");
const reservationForm = document.querySelector("#reservation-form");
const selectedSlot = document.querySelector("#selected-slot");
const reservationStatus = document.querySelector("#reservation-status");
const partySize = document.querySelector("#party-size");
const reservationEvent = document.querySelector("#reservation-event");
const depositNote = document.querySelector("#deposit-note");
const reservationTicket = document.querySelector("#reservation-ticket");
const ticketContent = document.querySelector("#ticket-content");

let currentPage = 1;
let selectedRestaurant = null;
let selectedTime = null;
let selectedSlotCapacity = 0;
let customer = null;

try {
  customer = JSON.parse(localStorage.getItem(sessionKey) || "null");
} catch {
  customer = null;
}

if (customer) {
  customerSession.textContent = `Hola, ${customer.name}`;
} else {
  customerSession.textContent = "Regístrate para reservar";
}

reservationDate.min = new Date().toISOString().slice(0, 10);

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  })[character]);
}

function setStatus(message, tone = "") {
  locationsStatus.textContent = message;
  locationsStatus.classList.toggle("is-success", tone === "success");
  locationsStatus.classList.toggle("is-error", tone === "error");
}

function formatCurrency(amount) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(amount);
}

function updateDepositNote() {
  const amount = Number(partySize.value) <= 3 ? 50000 : 100000;
  depositNote.textContent = `Abono requerido: ${formatCurrency(amount)}`;
}

function renderPagination(page, totalPages) {
  pagination.innerHTML = "";
  if (totalPages <= 1) return;

  for (let number = 1; number <= totalPages; number += 1) {
    const button = document.createElement("button");
    button.className = "pagination-button";
    button.type = "button";
    button.textContent = number;
    button.ariaLabel = `Ir a la página ${number}`;
    button.ariaCurrent = number === page ? "page" : "false";
    if (number === page) button.classList.add("is-active");
    button.addEventListener("click", () => loadRestaurants(number));
    pagination.appendChild(button);
  }
}

function renderRestaurants(items) {
  results.innerHTML = items.length
    ? items.map((restaurant) => `
      <article class="location-card">
        <div>
          <p class="location-card-kicker">${escapeHtml(restaurant.cuisineType)}</p>
          <h3>${escapeHtml(restaurant.name)}</h3>
          <p class="location-address">${escapeHtml(restaurant.address)}</p>
          <p class="location-capacity">Capacidad: ${restaurant.maxCapacity} personas</p>
        </div>
        <button class="button button-small" type="button" data-select-id="${restaurant.id}">
          Seleccionar sede
        </button>
      </article>`).join("")
    : '<p class="field-hint">No encontramos sedes con esos filtros.</p>';

  results.querySelectorAll("[data-select-id]").forEach((button) => {
    button.addEventListener("click", () => selectRestaurant(items.find((item) => item.id === button.dataset.selectId)));
  });
}

async function loadRestaurants(page = 1) {
  currentPage = page;
  const params = new URLSearchParams({
    location: locationFilter.value,
    cuisine: cuisineFilter.value,
    page: String(page),
    limit: "6",
  });
  setStatus("Cargando sedes...");

  try {
    const response = await fetch(`/api/restaurants/search?${params}`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.message);
    renderRestaurants(data.restaurants);
    resultsCount.textContent = `${data.total} sedes encontradas`;
    renderPagination(data.page, data.totalPages);
    setStatus("Resultados actualizados.", "success");
  } catch {
    results.innerHTML = "";
    setStatus("No se pudieron cargar las sedes.", "error");
  }
}

function selectRestaurant(restaurant) {
  if (!customer) {
    setStatus("Crea tu cuenta antes de seleccionar una sede para reservar.", "error");
    window.scrollTo({ top: 0, behavior: "smooth" });
    return;
  }

  selectedRestaurant = restaurant;
  selectedTime = null;
  selectedSlotCapacity = 0;
  selectedLocation.textContent = `${restaurant.name} · ${restaurant.address}`;
  reservationPanel.hidden = false;
  reservationForm.hidden = true;
  reservationTicket.hidden = true;
  slotList.innerHTML = "";
  reservationPanel.scrollIntoView({ behavior: "smooth", block: "start" });
}

availabilityForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!selectedRestaurant || !reservationDate.value) return;
  slotList.innerHTML = "Consultando disponibilidad...";
  reservationForm.hidden = true;

  try {
    const response = await fetch(`/api/restaurants/${selectedRestaurant.id}/availability?date=${reservationDate.value}`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.message);

    slotList.innerHTML = data.slots.length
      ? data.slots.map((slot) => `
        <button class="slot-button" type="button" data-time="${slot.time}" data-available-people="${slot.availablePeople}" ${slot.available ? "" : "disabled"}>
          <strong>${slot.time}</strong><small>${slot.availablePeople} cupos disponibles</small>
        </button>`).join("")
      : '<p class="field-hint">La sede está cerrada en la fecha seleccionada.</p>';

    slotList.querySelectorAll("[data-time]").forEach((button) => {
      button.addEventListener("click", () => {
        selectedTime = button.dataset.time;
        selectedSlotCapacity = Number(button.dataset.availablePeople);
        partySize.max = String(selectedSlotCapacity);
        partySize.value = String(Math.min(Number(partySize.value), selectedSlotCapacity));
        updateDepositNote();
        selectedSlot.textContent = `${selectedRestaurant.name} · ${reservationDate.value} a las ${selectedTime}`;
        reservationForm.hidden = false;
        reservationTicket.hidden = true;
        reservationForm.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });
  } catch (error) {
    slotList.innerHTML = `<p class="field-error">${escapeHtml(error.message || "No se pudo consultar la disponibilidad.")}</p>`;
  }
});

reservationForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const requestedPartySize = Number(partySize.value);
  if (!selectedSlotCapacity || requestedPartySize > selectedSlotCapacity) {
    reservationStatus.textContent = `Este horario tiene capacidad para ${selectedSlotCapacity} persona(s) como máximo.`;
    reservationStatus.classList.add("is-error");
    return;
  }
  reservationStatus.textContent = "Confirmando reserva...";
  reservationStatus.classList.remove("is-error", "is-success");

  try {
    const response = await fetch("/api/reservations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: customer.id,
        restaurantId: selectedRestaurant.id,
        date: reservationDate.value,
        time: selectedTime,
        partySize: requestedPartySize,
        event: reservationEvent.value,
      }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message);
    reservationStatus.textContent = `Reserva confirmada. Código: ${data.ticket.id}`;
    reservationStatus.classList.add("is-success");
    ticketContent.innerHTML = `
      <dl class="ticket-details">
        <div><dt>Código</dt><dd>${escapeHtml(data.ticket.id)}</dd></div>
        <div><dt>A nombre de</dt><dd>${escapeHtml(data.ticket.customerName)}</dd></div>
        <div><dt>Correo</dt><dd>${escapeHtml(data.ticket.customerEmail)}</dd></div>
        <div><dt>Sede</dt><dd>${escapeHtml(data.ticket.restaurantName)}</dd></div>
        <div><dt>Dirección</dt><dd>${escapeHtml(data.ticket.restaurantAddress)}</dd></div>
        <div><dt>Fecha y hora</dt><dd>${escapeHtml(data.ticket.date)} · ${escapeHtml(data.ticket.time)}</dd></div>
        <div><dt>Personas</dt><dd>${data.ticket.partySize}</dd></div>
        <div><dt>Evento</dt><dd>${escapeHtml(data.ticket.event)}</dd></div>
        <div><dt>Abono</dt><dd>${formatCurrency(data.ticket.depositAmount)}</dd></div>
        <div><dt>Estado</dt><dd>${escapeHtml(data.ticket.status)}</dd></div>
      </dl>`;
    reservationTicket.hidden = false;
    reservationTicket.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (error) {
    reservationStatus.textContent = error.message || "No se pudo confirmar la reserva.";
    reservationStatus.classList.add("is-error");
  }
});

partySize.addEventListener("input", updateDepositNote);
updateDepositNote();

searchForm.addEventListener("submit", (event) => {
  event.preventDefault();
  loadRestaurants(1);
});

locationFilter.addEventListener("change", () => loadRestaurants(1));
cuisineFilter.addEventListener("change", () => loadRestaurants(1));

loadRestaurants();
