/* =====================================================================
   ReservaYa - Registro de usuario
   POST /api/auth/register → redirección a login tras registro exitoso
   ===================================================================== */

redirectIfLoggedIn();

const registrationForm = document.querySelector("#registration-form");
const nameInput = document.querySelector("#name");
const emailInput = document.querySelector("#email");
const passwordInput = document.querySelector("#password");
const passwordToggle = document.querySelector(".password-toggle");
const statusMessage = document.querySelector("#status");

const inputs = { name: nameInput, email: emailInput, password: passwordInput };

const errors = {
  name: document.querySelector("#name-error"),
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
  Object.values(errors).forEach(function (error) { error.textContent = ""; });
  Object.values(inputs).forEach(function (input) { input.removeAttribute("aria-invalid"); });
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
  passwordToggle.addEventListener("pointerdown", function (event) {
    event.preventDefault();
    showPassword();
  });

  ["pointerup", "pointerleave", "pointercancel", "blur"].forEach(function (type) {
    passwordToggle.addEventListener(type, hidePassword);
  });

  passwordToggle.addEventListener("keydown", function (event) {
    if (event.key === " " || event.key === "Enter") {
      event.preventDefault();
      showPassword();
    }
  });

  passwordToggle.addEventListener("keyup", function (event) {
    if (event.key === " " || event.key === "Enter") {
      hidePassword();
    }
  });
}

if (registrationForm) {
  registrationForm.addEventListener("submit", async function (event) {
    event.preventDefault();
    clearErrors();

    const name = nameInput.value.trim();
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    const roleInput = document.querySelector('input[name="role"]:checked');
    const role = roleInput ? roleInput.value : "CLIENT";
    let isValid = true;

    if (name.length < 2) {
      showError("name", "Escribe un nombre válido (mínimo 2 caracteres).");
      isValid = false;
    }

    if (!emailInput.validity.valid || email.length === 0) {
      showError("email", "Introduce un correo electrónico válido.");
      isValid = false;
    }

    if (password.length < 8) {
      showError("password", "La contraseña debe tener al menos 8 caracteres.");
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
        setStatus(result.message || "No se pudo completar el registro.", "error");
        return;
      }

      const data = await response.json();

      /* Auto-login: guardar sesión y redirigir según rol */
      saveSession(data.token, data.user);
      redirectByRole(data.user);
    } catch {
      setStatus("No se pudo conectar con el servidor.", "error");
    }
  });
}
