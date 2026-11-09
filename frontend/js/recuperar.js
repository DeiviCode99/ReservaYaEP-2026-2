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

function fieldError(input, errorElement, message) {
  errorElement.textContent = message;
  if (message) input.setAttribute("aria-invalid", "true");
  else input.removeAttribute("aria-invalid");
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
  showStatus(requestStatus, "Enviando...");
  try {
    const data = await apiFetch("/api/auth/forgot-password", { method: "POST", body: JSON.stringify({ email: email }) });
    showStatus(requestStatus, data.message + " Revisa también la carpeta de spam.", "success");
  } catch (error) {
    showStatus(requestStatus, errorText(error), "error");
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
  showStatus(resetStatus, "Guardando...");
  try {
    const data = await apiFetch("/api/auth/reset-password", { method: "POST", body: JSON.stringify({ token: token, password: password }) });
    saveSession(data.token, data.user);
    redirectByRole(data.user);
  } catch (error) {
    button.disabled = false;
    resetStatus.classList.add("is-error");
    resetStatus.innerHTML = escapeHtml(errorText(error)) +
      ' <a href="recuperar.html">Pedir un enlace nuevo</a>';
  }
});
