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
  Object.values(errors).forEach((error) => {
    error.textContent = "";
  });
  Object.values(inputs).forEach((input) => {
    input.removeAttribute("aria-invalid");
  });
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
  passwordToggle.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    showPassword();
  });

  ["pointerup", "pointerleave", "pointercancel", "blur"].forEach((type) => {
    passwordToggle.addEventListener(type, hidePassword);
  });

  passwordToggle.addEventListener("keydown", (event) => {
    if (event.key === " " || event.key === "Enter") {
      event.preventDefault();
      showPassword();
    }
  });

  passwordToggle.addEventListener("keyup", (event) => {
    if (event.key === " " || event.key === "Enter") {
      hidePassword();
    }
  });
}

if (registrationForm) {
  registrationForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearErrors();

    const name = nameInput.value.trim();
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    let isValid = true;

    if (name.length < 2) {
      showError("name", "Escribe un nombre válido.");
      isValid = false;
    }

    if (!emailInput.validity.valid) {
      showError("email", "Introduce un correo electrónico válido.");
      isValid = false;
    }

    if (password.length < 8) {
      showError("password", "La contraseña debe tener al menos 8 caracteres.");
      isValid = false;
    }

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
        setStatus(result.message || "No se pudo completar el registro.", "error");
        return;
      }

      registrationForm.reset();
      setStatus(`Cuenta creada para ${result.user.name}.`, "success");
    } catch {
      setStatus("No se pudo conectar con el servidor.", "error");
    }
  });
}