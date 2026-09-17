const dayLabels = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
const sessionKey = "reservaya.adminSession";

const loginScreen = document.querySelector("#login-screen");
const dashboard = document.querySelector("#dashboard");
const sessionLabel = document.querySelector("#session-label");
const logoutButton = document.querySelector("#logout-button");
const demoLoginButton = document.querySelector("#demo-login-button");
const adminNameInput = document.querySelector("#admin-name");
const loginStatus = document.querySelector("#login-status");

const form = document.querySelector("#restaurant-form");
const formStatus = document.querySelector("#form-status");
const resetButton = document.querySelector("#reset-button");
const listEmpty = document.querySelector("#list-empty");
const restaurantList = document.querySelector("#restaurant-list");
const scheduleRows = document.querySelector("#schedule-rows");

const inputs = {
  name: document.querySelector("#restaurant-name"),
  address: document.querySelector("#restaurant-address"),
  cuisine: document.querySelector("#restaurant-cuisine"),
  capacity: document.querySelector("#restaurant-capacity"),
};

const inputErrors = {
  name: document.querySelector("#restaurant-name-error"),
  address: document.querySelector("#restaurant-address-error"),
  cuisine: document.querySelector("#restaurant-cuisine-error"),
  capacity: document.querySelector("#restaurant-capacity-error"),
};

const schedulesError = document.querySelector("#schedules-error");

let session = null;
let editingId = null;
let restaurants = [];

function readSession() {
  try {
    return JSON.parse(localStorage.getItem(sessionKey) || "null");
  } catch {
    return null;
  }
}

function writeSession(value) {
  if (value) {
    localStorage.setItem(sessionKey, JSON.stringify(value));
  } else {
    localStorage.removeItem(sessionKey);
  }
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char];
  });
}

function setStatus(element, message, tone) {
  element.textContent = message || "";
  element.classList.toggle("is-error", tone === "error");
  element.classList.toggle("is-success", tone === "success");
}

function buildScheduleRows(entries) {
  scheduleRows.innerHTML = "";

  dayLabels.forEach((label, index) => {
    const entry = entries ? entries[index] : null;
    const open = entry ? entry.open : "12:00";
    const close = entry ? entry.close : "22:00";
    const closed = entry ? entry.closed : false;

    const row = document.createElement("div");
    row.className = "schedule-row";
    row.innerHTML = `
      <span class="schedule-day">${label}</span>
      <label class="schedule-toggle">
        <input type="checkbox" class="schedule-closed" ${closed ? "checked" : ""} />
        Cerrado
      </label>
      <label class="schedule-time-field">Desde
        <input type="time" class="schedule-open" value="${open}" />
      </label>
      <label class="schedule-time-field">Hasta
        <input type="time" class="schedule-close" value="${close}" />
      </label>`;

    const checkbox = row.querySelector(".schedule-closed");
    const openInput = row.querySelector(".schedule-open");
    const closeInput = row.querySelector(".schedule-close");

    function syncDisabledState() {
      openInput.disabled = checkbox.checked;
      closeInput.disabled = checkbox.checked;
    }

    checkbox.addEventListener("change", syncDisabledState);
    syncDisabledState();

    scheduleRows.appendChild(row);
  });
}

function collectSchedules() {
  return [...scheduleRows.querySelectorAll(".schedule-row")].map((row, index) => ({
    day: dayLabels[index],
    open: row.querySelector(".schedule-open").value,
    close: row.querySelector(".schedule-close").value,
    closed: row.querySelector(".schedule-closed").checked,
  }));
}

function validateForm() {
  let valid = true;

  function check(field, message, condition) {
    if (condition) {
      inputErrors[field].textContent = message;
      valid = false;
    } else {
      inputErrors[field].textContent = "";
    }
  }

  const name = inputs.name.value.trim();
  const address = inputs.address.value.trim();
  const cuisine = inputs.cuisine.value.trim();
  const capacity = Number(inputs.capacity.value);

  check("name", "El nombre del restaurante es obligatorio (mínimo 2 caracteres).", name.length < 2);
  check("address", "La dirección es obligatoria (mínimo 5 caracteres).", address.length < 5);
  check("cuisine", "El tipo de cocina es obligatorio (mínimo 2 caracteres).", cuisine.length < 2);
  check(
    "capacity",
    "La capacidad debe ser un número entero entre 1 y 500.",
    !Number.isInteger(capacity) || capacity < 1 || capacity > 500,
  );

  const schedules = collectSchedules();
  let scheduleError = "";

  if (schedules.every((entry) => entry.closed)) {
    scheduleError = "Debe haber al menos un día abierto.";
  } else {
    for (const entry of schedules) {
      if (entry.closed) continue;

      if (!entry.open || !entry.close) {
        scheduleError = `Completa los horarios del ${entry.day}.`;
        break;
      }

      if (entry.open >= entry.close) {
        scheduleError = `El horario del ${entry.day} es inválido: la apertura debe ser antes del cierre.`;
        break;
      }
    }
  }

  if (scheduleError) {
    schedulesError.textContent = scheduleError;
    valid = false;
  } else {
    schedulesError.textContent = "";
  }

  return valid ? { name, address, cuisineType: cuisine, maxCapacity: capacity, schedules } : null;
}

function resetForm() {
  editingId = null;
  form.reset();
  Object.values(inputErrors).forEach((error) => {
    error.textContent = "";
  });
  schedulesError.textContent = "";
  setStatus(formStatus, "");
  buildScheduleRows(null);
}

function renderRestaurantList() {
  listEmpty.hidden = restaurants.length > 0;
  listEmpty.textContent = restaurants.length
    ? ""
    : "Aún no tienes restaurantes registrados. Completa el formulario para crear el primero.";
  restaurantList.innerHTML = "";

  restaurants.forEach((restaurant) => {
    const openDays = restaurant.schedules.filter((entry) => !entry.closed);
    const scheduleSummary =
      openDays.length === 7
        ? "Todos los días de la semana"
        : openDays.map((entry) => entry.day).join(", ");

    const item = document.createElement("li");
    item.className = "restaurant-card";
    item.innerHTML = `
      <div class="restaurant-card-head">
        <h3>${escapeHtml(restaurant.name)}</h3>
        <span class="badge">${escapeHtml(restaurant.cuisineType)}</span>
      </div>
      <p class="restaurant-address">${escapeHtml(restaurant.address)}</p>
      <p class="restaurant-meta">Capacidad máxima: ${restaurant.maxCapacity} personas</p>
      <p class="restaurant-meta">Atención: ${escapeHtml(scheduleSummary)}</p>
      <div class="restaurant-actions">
        <button class="button button-small button-outline" type="button" data-action="edit">
          Editar
        </button>
        <button class="button button-small button-danger" type="button" data-action="delete">
          Eliminar
        </button>
      </div>`;

    item.querySelector('[data-action="edit"]').addEventListener("click", () => {
      editRestaurant(restaurant);
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
    item.querySelector('[data-action="delete"]').addEventListener("click", () => {
      deleteRestaurant(restaurant);
    });

    restaurantList.appendChild(item);
  });
}

async function loadRestaurants() {
  try {
    const response = await fetch("/api/restaurants", {
      headers: { Authorization: `Bearer ${session.token}` },
    });

    if (response.status === 401) {
      handleExpiredSession();
      return;
    }

    const result = await response.json();
    restaurants = result.restaurants || [];
    renderRestaurantList();
  } catch {
    listEmpty.hidden = false;
    listEmpty.textContent = "No se pudo cargar la lista de restaurantes.";
  }
}

function editRestaurant(restaurant) {
  editingId = restaurant.id;
  inputs.name.value = restaurant.name;
  inputs.address.value = restaurant.address;
  inputs.cuisine.value = restaurant.cuisineType;
  inputs.capacity.value = restaurant.maxCapacity;
  buildScheduleRows(restaurant.schedules);

  Object.values(inputErrors).forEach((error) => {
    error.textContent = "";
  });
  schedulesError.textContent = "";
  setStatus(formStatus, `Editando: ${restaurant.name}. Guarda para aplicar los cambios.`);
  form.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function deleteRestaurant(restaurant) {
  const confirmed = confirm(
    `¿Eliminar el restaurante "${restaurant.name}"? Esta acción no se puede deshacer.`,
  );
  if (!confirmed) return;

  try {
    const response = await fetch(`/api/restaurants/${restaurant.id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${session.token}` },
    });
    const result = await response.json();

    if (!response.ok) {
      setStatus(formStatus, result.message || "No se pudo eliminar el restaurante.", "error");
      return;
    }

    if (editingId === restaurant.id) {
      resetForm();
    }
    setStatus(formStatus, "Restaurante eliminado correctamente.", "success");
    await loadRestaurants();
  } catch {
    setStatus(formStatus, "No se pudo conectar con el servidor.", "error");
  }
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  setStatus(formStatus, "");

  const payload = validateForm();
  if (!payload) return;

  const endpoint = editingId ? `/api/restaurants/${editingId}` : "/api/restaurants";

  try {
    const response = await fetch(endpoint, {
      method: editingId ? "PUT" : "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.token}`,
      },
      body: JSON.stringify(payload),
    });
    const result = await response.json();

    if (!response.ok) {
      if (response.status === 401) {
        handleExpiredSession();
        return;
      }
      setStatus(formStatus, result.message || "No se pudo guardar el restaurante.", "error");
      return;
    }

    setStatus(
      formStatus,
      editingId ? "Restaurante actualizado correctamente." : "Restaurante registrado correctamente.",
      "success",
    );

    if (!editingId) {
      resetForm();
    }
    await loadRestaurants();
  } catch {
    setStatus(formStatus, "No se pudo conectar con el servidor.", "error");
  }
});

resetButton.addEventListener("click", resetForm);

demoLoginButton.addEventListener("click", async () => {
  setStatus(loginStatus, "");

  try {
    const response = await fetch("/api/demo/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: adminNameInput.value.trim() }),
    });
    const result = await response.json();

    if (!response.ok) {
      setStatus(loginStatus, result.message || "No se pudo iniciar sesión.", "error");
      return;
    }

    writeSession({ token: result.token, name: result.admin.name });
    setStatus(loginStatus, "");
    showDashboard();
  } catch {
    setStatus(loginStatus, "No se pudo conectar con el servidor.", "error");
  }
});

logoutButton.addEventListener("click", () => {
  writeSession(null);
  showLogin();
  setStatus(loginStatus, "Sesión cerrada.");
});

function handleExpiredSession() {
  writeSession(null);
  showLogin();
  setStatus(loginStatus, "La sesión expiró. Vuelve a iniciar sesión.", "error");
}

function showDashboard() {
  session = readSession();
  if (!session) {
    showLogin();
    return;
  }

  loginScreen.hidden = true;
  dashboard.hidden = false;
  sessionLabel.textContent = `Sesión: ${session.name}`;
  sessionLabel.hidden = false;
  logoutButton.hidden = false;

  resetForm();
  loadRestaurants();
}

function showLogin() {
  session = null;
  loginScreen.hidden = false;
  dashboard.hidden = true;
  sessionLabel.hidden = true;
  logoutButton.hidden = true;
  restaurants = [];
}

buildScheduleRows(null);
showDashboard();