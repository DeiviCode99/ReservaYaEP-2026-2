/* =====================================================================
   ReservaYa - Inicio de sesión
   POST /api/auth/login → redirección según rol (CLIENT / RESTAURANT_ADMIN)
   ===================================================================== */

redirectIfLoggedIn();

const loginForm = document.querySelector("#login-form");
const emailInput = document.querySelector("#email");
const passwordInput = document.querySelector("#password");
const passwordToggle = document.querySelector(".password-toggle");
const statusMessage = document.querySelector("#status");

const inputs = { email: emailInput, password: passwordInput };
const errors = {
  email: document.querySelector("#email-error"),
  password: document.querySelector("#password-error"),
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
  Object.values(errors).forEach(function (el) { el.textContent = ""; });
  Object.values(inputs).forEach(function (el) { el.removeAttribute("aria-invalid"); });
  setStatus("");
}

/* Toggle de contraseña (mantener pulsado) */
if (passwordToggle) {
  function showPassword() {
    passwordInput.type = "text";
    passwordToggle.dataset.visible = "true";
    passwordToggle.setAttribute("aria-pressed", "true");
  }

  function hidePassword() {
    passwordInput.type = "password";
    passwordToggle.dataset.visible = "false";
    passwordToggle.setAttribute("aria-pressed", "false");
  }

  passwordToggle.addEventListener("pointerdown", function (e) { e.preventDefault(); showPassword(); });
  ["pointerup", "pointerleave", "pointercancel", "blur"].forEach(function (type) {
    passwordToggle.addEventListener(type, hidePassword);
  });
  passwordToggle.addEventListener("keydown", function (e) {
    if (e.key === " " || e.key === "Enter") { e.preventDefault(); showPassword(); }
  });
  passwordToggle.addEventListener("keyup", function (e) {
    if (e.key === " " || e.key === "Enter") { hidePassword(); }
  });
}

loginForm.addEventListener("submit", async function (event) {
  event.preventDefault();
  clearErrors();

  const email = emailInput.value.trim();
  const password = passwordInput.value;
  let isValid = true;

  if (!emailInput.validity.valid || email.length === 0) {
    showError("email", "Introduce un correo electrónico válido.");
    isValid = false;
  }

  if (password.length === 0) {
    showError("password", "Ingresa tu contraseña.");
    isValid = false;
  }

  if (!isValid) return;

  try {
    const response = await fetch(API_BASE + "/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    if (response.status === 401) {
      setStatus("Correo o contraseña incorrectos.", "error");
      return;
    }

    if (!response.ok) {
      const result = await response.json().catch(function () { return {}; });
      setStatus(result.message || "No se pudo iniciar sesión.", "error");
      return;
    }

    const data = await response.json();
    saveSession(data.token, data.user);
    redirectByRole(data.user);
  } catch {
    setStatus("No se pudo conectar con el servidor.", "error");
  }
});
