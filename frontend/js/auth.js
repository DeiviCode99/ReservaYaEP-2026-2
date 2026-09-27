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
