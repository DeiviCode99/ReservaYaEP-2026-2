/* =====================================================================
   ReservaYa - Módulo compartido de autenticación
   Manejo de sesión JWT, redirección por rol y utilidades comunes.
   ===================================================================== */

// En desarrollo (server.js en el 3000) se llama al gateway directo; en
// produccion Caddy sirve el frontend y la API en el mismo dominio.
const API_BASE = location.port === "3000" ? "http://localhost:8080" : "";
const SESSION_KEY = "reservaya.session";

function getSession() {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
  } catch {
    return null;
  }
}

function saveSession(token, user) {
  localStorage.setItem(SESSION_KEY, JSON.stringify({ token, user }));
}

function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

function getToken() {
  const session = getSession();
  return session ? session.token : null;
}

function getUser() {
  const session = getSession();
  return session ? session.user : null;
}

function isLoggedIn() {
  return getToken() !== null;
}

function logout() {
  clearSession();
  window.location.href = "login.html";
}

function requireRole(allowedRole) {
  const user = getUser();
  if (!user) {
    window.location.replace("login.html");
    return false;
  }
  if (user.role !== allowedRole) {
    window.location.replace("login.html");
    return false;
  }
  return true;
}

function redirectIfLoggedIn() {
  const user = getUser();
  if (!user) return;

  if (user.role === "RESTAURANT_ADMIN") {
    window.location.replace("admin.html");
  } else {
    window.location.replace("cliente.html");
  }
}

function redirectByRole(user) {
  if (user.role === "RESTAURANT_ADMIN") {
    window.location.href = "admin.html";
  } else {
    window.location.href = "cliente.html";
  }
}

function authHeaders() {
  const token = getToken();
  const headers = { "Content-Type": "application/json" };
  if (token) {
    headers["Authorization"] = "Bearer " + token;
  }
  return headers;
}

function handleUnauthorized() {
  clearSession();
  window.location.replace("login.html");
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, function (char) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char];
  });
}

/* Escribe el mensaje dentro de un estado vacío sin borrar su ilustración. */
function setEmptyText(container, message) {
  const text = container.querySelector(".empty-text");
  if (text) {
    text.textContent = message;
  } else {
    container.textContent = message;
  }
}

/* ---------------------------------------------------------------------
   Utilidades compartidas por los paneles
   --------------------------------------------------------------------- */

/* Llamada al gateway con el token de la sesión. Devuelve el JSON de la
   respuesta o lanza un Error con el mensaje que manda el backend. Un 401
   (sesión vencida) cierra la sesión y lleva al login. */
async function apiFetch(path, options) {
  const response = await fetch(API_BASE + path, Object.assign({ headers: authHeaders() }, options));
  if (response.status === 401) {
    handleUnauthorized();
    throw new Error("Tu sesión expiró.");
  }
  const data = await response.json().catch(function () { return {}; });
  if (!response.ok) throw new Error(data.message || "No se pudo completar la solicitud.");
  return data;
}

/* Mensaje de estado bajo un formulario: tone = "success" | "error" | nada. */
function showStatus(element, message, tone) {
  element.textContent = message || "";
  element.classList.toggle("is-success", tone === "success");
  element.classList.toggle("is-error", tone === "error");
}

/* Mensaje legible para un error de apiFetch: sin red, fetch lanza TypeError. */
function errorText(error) {
  return error instanceof TypeError ? "No se pudo conectar con el servidor." : error.message;
}

/* El color del distintivo es información: verde confirmada, mostaza en
   espera, ladrillo cancelada o rechazada, gris completada. */
const RESERVATION_STATUS = {
  PENDING: { label: "Pendiente", badge: "badge-warn" },
  CONFIRMED: { label: "Confirmada", badge: "badge-ok" },
  CANCELLED: { label: "Cancelada", badge: "badge-alert" },
  REJECTED: { label: "Rechazada", badge: "badge-alert" },
  COMPLETED: { label: "Completada", badge: "badge-off" },
};

function statusBadge(status) {
  const info = RESERVATION_STATUS[status] || { label: status, badge: "" };
  return '<span class="badge ' + info.badge + '">' + escapeHtml(info.label) + "</span>";
}

/* "2026-09-24" → "24 de septiembre" */
function formatDate(value) {
  if (!value) return "";
  const parts = String(value).split("-");
  if (parts.length !== 3) return value;
  const date = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  return date.toLocaleDateString("es-CO", { day: "numeric", month: "long" });
}

/* Fecha local de hoy en formato ISO (no UTC, para que no salte de día en la noche). */
function todayIso() {
  return isoDaysFromToday(0);
}

function isoDaysFromToday(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 10);
}

/* ── Notificaciones en vivo (campanita) ─────────────────────────────
   Cada panel pasa `check`: consulta el backend y devuelve los mensajes nuevos
   desde la última revisión. Se revisa al cargar, cada 15 s y al volver a la pestaña.
   ponytail: sondeo cada 15 s; si hace falta inmediatez real, SSE desde reservation-service. */
const NOTIFY_INTERVAL_MS = 15000;

function setupNotifications(check) {
  const box = document.createElement("div");
  box.className = "notify";
  box.innerHTML =
    '<button class="notify-bell" type="button" aria-expanded="false" aria-label="Notificaciones">' +
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 22a2.5 2.5 0 0 0 2.45-2h-4.9A2.5 2.5 0 0 0 12 22Zm7-6v-5a7 7 0 0 0-5.5-6.84V3a1.5 1.5 0 0 0-3 0v1.16A7 7 0 0 0 5 11v5l-2 2v1h18v-1Z"/></svg>' +
      '<span class="notify-count" hidden></span>' +
    "</button>" +
    '<div class="notify-panel" hidden>' +
      '<p class="notify-title">Notificaciones</p>' +
      '<ul class="notify-list"></ul>' +
      '<p class="notify-empty">Sin novedades por ahora.</p>' +
    "</div>";
  document.querySelector(".nav-actions").prepend(box);

  const toast = document.createElement("div");
  toast.className = "notify-toast";
  toast.setAttribute("role", "status");
  toast.hidden = true;
  document.body.appendChild(toast);

  const bell = box.querySelector(".notify-bell");
  const count = box.querySelector(".notify-count");
  const panel = box.querySelector(".notify-panel");
  const list = box.querySelector(".notify-list");
  const empty = box.querySelector(".notify-empty");
  let unread = 0;
  let toastTimer = null;
  let running = false;

  function renderCount() {
    count.hidden = unread === 0;
    count.textContent = unread > 9 ? "9+" : String(unread);
    bell.setAttribute("aria-label", unread ? "Notificaciones: " + unread + " sin leer" : "Notificaciones");
  }

  function setOpen(open) {
    panel.hidden = !open;
    bell.setAttribute("aria-expanded", String(open));
    if (open) {
      unread = 0;
      renderCount();
      // Avisos del sistema cuando la pestaña no está visible; se pide permiso con un clic del usuario.
      if ("Notification" in window && Notification.permission === "default") Notification.requestPermission();
    }
  }

  bell.addEventListener("click", function () { setOpen(panel.hidden); });
  document.addEventListener("click", function (event) { if (!box.contains(event.target)) setOpen(false); });
  document.addEventListener("keydown", function (event) { if (event.key === "Escape") setOpen(false); });

  function push(messages) {
    messages.forEach(function (message) {
      const item = document.createElement("li");
      item.textContent = message;
      list.prepend(item);
    });
    while (list.children.length > 20) list.lastChild.remove();
    empty.hidden = true;
    unread += messages.length;
    renderCount();

    const text = messages.length === 1 ? messages[0] : messages.length + " novedades. Revisa la campanita.";
    toast.textContent = text;
    toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toast.hidden = true; }, 7000);
    if (document.hidden && "Notification" in window && Notification.permission === "granted") {
      new Notification("ReservaYa", { body: text, icon: "../images/favicon.svg" });
    }
  }

  async function run() {
    if (running) return;
    running = true;
    try {
      const messages = await check();
      if (messages.length) push(messages);
    } catch {
      // Sin red o sesión caída: se reintenta en el siguiente ciclo.
    } finally {
      running = false;
    }
  }

  setInterval(run, NOTIFY_INTERVAL_MS);
  document.addEventListener("visibilitychange", function () { if (!document.hidden) run(); });
  run();
  return { run: run };
}

/* Lo último que vio la campanita, por usuario: así también avisa lo que pasó mientras no estaba. */
function notifySnapshot(name) {
  const key = "reservaya.notify." + name + "." + (getUser() || {}).id;
  return {
    load: function () {
      try { return JSON.parse(localStorage.getItem(key)); } catch { return null; }
    },
    save: function (value) {
      try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* sin almacenamiento */ }
    },
  };
}

/* Ciudades del área metropolitana. La búsqueda del cliente compara el texto
   exacto, así que el administrador elige de esta misma lista. */
const CITIES = ["Bucaramanga", "Floridablanca", "Girón", "Piedecuesta"];

/* Botón de Google (Google Identity Services). El client ID lo entrega el
   backend: si GOOGLE_CLIENT_ID no está configurado, el bloque sigue oculto y
   solo queda el formulario de correo y contraseña.
   options: { onStatus(msg, tone), getRole(), text: "signin_with" | "signup_with" } */
async function setupGoogleButton(container, options) {
  let clientId = "";
  try {
    const response = await fetch(API_BASE + "/api/auth/config");
    clientId = response.ok ? (await response.json()).googleClientId : "";
  } catch {
    return;
  }
  if (!clientId) return;

  const loaded = await new Promise(function (resolve) {
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.onload = function () { resolve(true); };
    script.onerror = function () { resolve(false); };
    document.head.appendChild(script);
  });
  if (!loaded) return;

  google.accounts.id.initialize({
    client_id: clientId,
    callback: async function (answer) {
      options.onStatus("Entrando con Google...");
      try {
        const response = await fetch(API_BASE + "/api/auth/google", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            credential: answer.credential,
            role: options.getRole ? options.getRole() : "CLIENT",
          }),
        });
        const data = await response.json().catch(function () { return {}; });
        if (!response.ok) {
          options.onStatus(data.message || "No se pudo entrar con Google.", "error");
          return;
        }
        saveSession(data.token, data.user);
        redirectByRole(data.user);
      } catch {
        options.onStatus("No se pudo conectar con el servidor.", "error");
      }
    },
  });

  container.hidden = false;
  const slot = container.querySelector(".google-button");
  google.accounts.id.renderButton(slot, {
    theme: "outline",
    size: "large",
    shape: "rectangular",
    text: options.text || "continue_with",
    locale: "es",
    width: Math.min(slot.clientWidth || 320, 400),
  });
}
