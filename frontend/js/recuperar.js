/* =====================================================================
   ReservaYa - Recuperación de cuenta
   Sin token: POST /api/auth/forgot-password (envía el enlace por correo).
   Con ?token=: POST /api/auth/reset-password y entra directo a la cuenta.
   ===================================================================== */

const token = new URLSearchParams(location.search).get("token");
// El token no debe quedar en el historial ni en marcadores.
if (token) history.replaceState(null, "", location.pathname);

const requestSection = document.querySelector("#request-section");
const resetSection = document.querySelector("#reset-section");
requestSection.hidden = Boolean(token);
resetSection.hidden = !token;

function setStatus(element, message, tone) {
  element.textContent = message || "";
  element.classList.toggle("is-success", tone === "success");
  element.classList.toggle("is-error", tone === "error");
}

function fieldError(input, errorElement, message) {
  errorElement.textContent = message;
  if (message) input.setAttribute("aria-invalid", "true");
  else input.removeAttribute("aria-invalid");
}

async function postJson(path, body) {
  const response = await fetch(API_BASE + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(function () { return {}; });
  if (!response.ok) throw new Error(data.message || "No se pudo completar la solicitud.");
  return data;
}

/* -- 1. Pedir el enlace --------------------------------------------- */

const requestForm = document.querySelector("#request-form");
const emailInput = document.querySelector("#email");
const requestStatus = document.querySelector("#request-status");

requestForm.addEventListener("submit", async function (event) {
  event.preventDefault();
  const email = emailInput.value.trim();
  const emailError = document.querySelector("#email-error");
  if (!emailInput.validity.valid || !email) {
    fieldError(emailInput, emailError, "Introduce un correo electrónico válido.");
    return;
  }
  fieldError(emailInput, emailError, "");

  const button = requestForm.querySelector("button");
  button.disabled = true;
  setStatus(requestStatus, "Enviando...");
  try {
    const data = await postJson("/api/auth/forgot-password", { email: email });
    setStatus(requestStatus, data.message + " Revisa también la carpeta de spam.", "success");
  } catch (error) {
    setStatus(requestStatus, error instanceof TypeError
      ? "No se pudo conectar con el servidor." : error.message, "error");
  } finally {
    button.disabled = false;
  }
});

/* -- 2. Elegir la contraseña nueva ---------------------------------- */

const resetForm = document.querySelector("#reset-form");
const passwordInput = document.querySelector("#password");
const confirmInput = document.querySelector("#password-confirm");
const resetStatus = document.querySelector("#reset-status");

resetForm.addEventListener("submit", async function (event) {
  event.preventDefault();
  const password = passwordInput.value;
  const passwordError = document.querySelector("#password-error");
  const confirmError = document.querySelector("#confirm-error");

  fieldError(passwordInput, passwordError,
    password.length < 8 ? "La contraseña debe tener al menos 8 caracteres." : "");
  fieldError(confirmInput, confirmError,
    confirmInput.value !== password ? "Las contraseñas no coinciden." : "");
  if (passwordError.textContent || confirmError.textContent) return;

  const button = resetForm.querySelector("button");
  button.disabled = true;
  setStatus(resetStatus, "Guardando...");
  try {
    const data = await postJson("/api/auth/reset-password", { token: token, password: password });
    saveSession(data.token, data.user);
    redirectByRole(data.user);
  } catch (error) {
    button.disabled = false;
    resetStatus.classList.add("is-error");
    resetStatus.innerHTML = escapeHtml(error instanceof TypeError
      ? "No se pudo conectar con el servidor." : error.message) +
      ' <a href="recuperar.html">Pedir un enlace nuevo</a>';
  }
});
