/* =====================================================================
   ReservaYa - Módulo compartido de autenticación
   Manejo de sesión JWT, redirección por rol y utilidades comunes.
   ===================================================================== */

const API_BASE = "http://localhost:8080";
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
