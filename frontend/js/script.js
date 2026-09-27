<<<<<<< HEAD
=======
/* =====================================================================
   ReservaYa - Registro de usuario
   POST /api/auth/register → redirección a login tras registro exitoso
   ===================================================================== */

redirectIfLoggedIn();

>>>>>>> backend
const registrationForm = document.querySelector("#registration-form");
const nameInput = document.querySelector("#name");
const emailInput = document.querySelector("#email");
const passwordInput = document.querySelector("#password");
<<<<<<< HEAD
const passwordToggle = document.querySelector(".password-toggle");
const statusMessage = document.querySelector("#status");
const bookingPanel = document.querySelector("#booking-panel");
const searchForm = document.querySelector("#restaurant-search-form");
const searchStatus = document.querySelector("#search-status");
const restaurantResults = document.querySelector("#restaurant-results");
const availabilitySection = document.querySelector("#availability-section");
const availabilityForm = document.querySelector("#availability-form");
const availabilityDate = document.querySelector("#reservation-date");
const slotList = document.querySelector("#slot-list");
const selectedRestaurant = document.querySelector("#selected-restaurant");
const reservationSection = document.querySelector("#reservation-section");
const selectedSlot = document.querySelector("#selected-slot");
const reservationForm = document.querySelector("#reservation-form");
const reservationStatus = document.querySelector("#reservation-status");

let registeredUser = null;
let selectedRestaurantId = null;
let selectedReservationSlot = null;

const inputs = { name: nameInput, email: emailInput, password: passwordInput };
=======
const passwordConfirmInput = document.querySelector("#password-confirm");
const passwordToggle = document.querySelector(".password-toggle");
const statusMessage = document.querySelector("#status");

const inputs = {
  name: nameInput,
  email: emailInput,
  password: passwordInput,
  passwordConfirm: passwordConfirmInput,
};
>>>>>>> backend

const errors = {
  name: document.querySelector("#name-error"),
  email: document.querySelector("#email-error"),
  password: document.querySelector("#password-error"),
<<<<<<< HEAD
=======
  passwordConfirm: document.querySelector("#password-confirm-error"),
>>>>>>> backend
};

function setStatus(message, tone) {
  statusMessage.textContent = message || "";
  statusMessage.classList.toggle("is-success", tone === "success");
  statusMessage.classList.toggle("is-error", tone === "error");
}

function showError(field, message) {
  errors[field].textContent = message;
  inputs[field].setAttribute("aria-invalid", "true");
}

function clearErrors() {
<<<<<<< HEAD
  Object.values(errors).forEach((error) => {
    error.textContent = "";
  });
  Object.values(inputs).forEach((input) => {
    input.removeAttribute("aria-invalid");
  });
=======
  Object.values(errors).forEach(function (error) { error.textContent = ""; });
  Object.values(inputs).forEach(function (input) { input.removeAttribute("aria-invalid"); });
>>>>>>> backend
  setStatus("");
}

function showPassword() {
  passwordInput.type = "text";
  passwordToggle.dataset.visible = "true";
  passwordToggle.setAttribute("aria-pressed", "true");
  passwordToggle.setAttribute("aria-label", "Suelta para ocultar la contraseña");
}

function hidePassword() {
  passwordInput.type = "password";
  passwordToggle.dataset.visible = "false";
  passwordToggle.setAttribute("aria-pressed", "false");
  passwordToggle.setAttribute("aria-label", "Mantener pulsado para mostrar la contraseña");
}

if (passwordToggle) {
<<<<<<< HEAD
  passwordToggle.addEventListener("pointerdown", (event) => {
=======
  passwordToggle.addEventListener("pointerdown", function (event) {
>>>>>>> backend
    event.preventDefault();
    showPassword();
  });

<<<<<<< HEAD
  ["pointerup", "pointerleave", "pointercancel", "blur"].forEach((type) => {
    passwordToggle.addEventListener(type, hidePassword);
  });

  passwordToggle.addEventListener("keydown", (event) => {
=======
  ["pointerup", "pointerleave", "pointercancel", "blur"].forEach(function (type) {
    passwordToggle.addEventListener(type, hidePassword);
  });

  passwordToggle.addEventListener("keydown", function (event) {
>>>>>>> backend
    if (event.key === " " || event.key === "Enter") {
      event.preventDefault();
      showPassword();
    }
  });

<<<<<<< HEAD
  passwordToggle.addEventListener("keyup", (event) => {
=======
  passwordToggle.addEventListener("keyup", function (event) {
>>>>>>> backend
    if (event.key === " " || event.key === "Enter") {
      hidePassword();
    }
  });
}

if (registrationForm) {
<<<<<<< HEAD
  registrationForm.addEventListener("submit", async (event) => {
=======
  registrationForm.addEventListener("submit", async function (event) {
>>>>>>> backend
    event.preventDefault();
    clearErrors();

    const name = nameInput.value.trim();
    const email = emailInput.value.trim();
    const password = passwordInput.value;
<<<<<<< HEAD
    let isValid = true;

    if (name.length < 2) {
      showError("name", "Escribe un nombre válido.");
      isValid = false;
    }

    if (!emailInput.validity.valid) {
=======
    const roleInput = document.querySelector('input[name="role"]:checked');
    const role = roleInput ? roleInput.value : "CLIENT";
    let isValid = true;

    if (name.length < 2) {
      showError("name", "Escribe un nombre válido (mínimo 2 caracteres).");
      isValid = false;
    }

    if (!emailInput.validity.valid || email.length === 0) {
>>>>>>> backend
      showError("email", "Introduce un correo electrónico válido.");
      isValid = false;
    }

    if (password.length < 8) {
      showError("password", "La contraseña debe tener al menos 8 caracteres.");
      isValid = false;
    }

<<<<<<< HEAD
    if (!isValid) {
      return;
    }

    try {
      const response = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });
      const result = await response.json();

      if (!response.ok) {
=======
    if (passwordConfirmInput.value !== password) {
      showError("passwordConfirm", "Las contraseñas no coinciden.");
      isValid = false;
    }

    if (!isValid) return;

    try {
      const response = await fetch(API_BASE + "/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, role }),
      });

      if (response.status === 409) {
        setStatus("Ya existe una cuenta con ese correo electrónico.", "error");
        return;
      }

      if (!response.ok) {
        const result = await response.json().catch(function () { return {}; });
>>>>>>> backend
        setStatus(result.message || "No se pudo completar el registro.", "error");
        return;
      }

<<<<<<< HEAD
      registrationForm.reset();
      setStatus(`Cuenta creada para ${result.user.name}.`, "success");
      registeredUser = result.user;
      localStorage.setItem("reservaya.user", JSON.stringify(result.user));
      window.location.href = "/html/sedes.html";
=======
      const data = await response.json();

      /* Auto-login: guardar sesión y redirigir según rol */
      saveSession(data.token, data.user);
      redirectByRole(data.user);
>>>>>>> backend
    } catch {
      setStatus("No se pudo conectar con el servidor.", "error");
    }
  });
}

<<<<<<< HEAD
function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  })[character]);
}

function setBookingStatus(element, message, tone = "") {
  element.textContent = message;
  element.classList.toggle("is-success", tone === "success");
  element.classList.toggle("is-error", tone === "error");
}

async function searchRestaurants(event) {
  event?.preventDefault();
  const params = new URLSearchParams({
    location: document.querySelector("#search-location").value.trim(),
    cuisine: document.querySelector("#search-cuisine").value.trim(),
    page: "1",
    limit: "6",
  });

  setBookingStatus(searchStatus, "Buscando sedes...");
  try {
    const response = await fetch(`/api/restaurants/search?${params}`);
    const result = await response.json();
    if (!response.ok) throw new Error(result.message);

    restaurantResults.innerHTML = result.restaurants.length
      ? result.restaurants.map((restaurant) => `
        <article class="restaurant-result">
          <div>
            <h3>${escapeHtml(restaurant.name)}</h3>
            <p>${escapeHtml(restaurant.address)} · ${escapeHtml(restaurant.cuisineType)}</p>
            <small>Capacidad: ${restaurant.maxCapacity} personas</small>
          </div>
          <button class="button button-small" type="button" data-restaurant-id="${restaurant.id}">
            Ver horarios
          </button>
        </article>`).join("")
      : '<p class="field-hint">No encontramos sedes con esos filtros.</p>';

    restaurantResults.querySelectorAll("[data-restaurant-id]").forEach((button) => {
      button.addEventListener("click", () => selectRestaurant(button.dataset.restaurantId));
    });
    setBookingStatus(searchStatus, `${result.total} sede(s) encontrada(s).`, "success");
  } catch {
    setBookingStatus(searchStatus, "No se pudo buscar las sedes.", "error");
  }
}

async function selectRestaurant(restaurantId) {
  const restaurant = [...restaurantResults.querySelectorAll("[data-restaurant-id]")]
    .find((button) => button.dataset.restaurantId === restaurantId)
    ?.closest(".restaurant-result");
  selectedRestaurantId = restaurantId;
  selectedReservationSlot = null;
  reservationSection.hidden = true;
  availabilitySection.hidden = false;
  selectedRestaurant.textContent = restaurant?.querySelector("h3")?.textContent || "Sede seleccionada";
  slotList.innerHTML = "";
  availabilitySection.scrollIntoView({ behavior: "smooth", block: "start" });
}

availabilityForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!selectedRestaurantId || !availabilityDate.value) return;

  slotList.innerHTML = "Cargando horarios...";
  try {
    const response = await fetch(`/api/restaurants/${selectedRestaurantId}/availability?date=${availabilityDate.value}`);
    const result = await response.json();
    if (!response.ok) throw new Error(result.message);

    slotList.innerHTML = result.slots.length
      ? result.slots.map((slot) => `
        <button class="slot-button" type="button" data-time="${slot.time}" ${slot.available ? "" : "disabled"}>
          <strong>${slot.time}</strong>
          <small>${slot.availablePeople} cupos</small>
        </button>`).join("")
      : '<p class="field-hint">La sede está cerrada en la fecha seleccionada.</p>';

    slotList.querySelectorAll("[data-time]").forEach((button) => {
      button.addEventListener("click", () => {
        selectedReservationSlot = button.dataset.time;
        selectedSlot.textContent = `${availabilityDate.value} a las ${selectedReservationSlot}`;
        reservationSection.hidden = false;
        reservationSection.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });
  } catch {
    slotList.innerHTML = '<p class="field-error">No se pudo consultar la disponibilidad.</p>';
  }
});

reservationForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const partySize = Number(document.querySelector("#party-size").value);
  setBookingStatus(reservationStatus, "Confirmando reserva...");

  try {
    const response = await fetch("/api/reservations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: registeredUser.id,
        restaurantId: selectedRestaurantId,
        date: availabilityDate.value,
        time: selectedReservationSlot,
        partySize,
      }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.message);

    setBookingStatus(reservationStatus, `Reserva confirmada. Código: ${result.reservation.id}`, "success");
    reservationForm.reset();
  } catch (error) {
    setBookingStatus(reservationStatus, error.message || "No se pudo confirmar la reserva.", "error");
  }
});

searchForm?.addEventListener("submit", searchRestaurants);
=======
setupGoogleButton(document.querySelector("#google-login"), {
  onStatus: setStatus,
  text: "signup_with",
  getRole: function () {
    const roleInput = document.querySelector('input[name="role"]:checked');
    return roleInput ? roleInput.value : "CLIENT";
  },
});
>>>>>>> backend
