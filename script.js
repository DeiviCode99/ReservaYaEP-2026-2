const registrationForm = document.querySelector("#registration-form");
const nameInput = document.querySelector("#name");
const emailInput = document.querySelector("#email");
const passwordInput = document.querySelector("#password");
const statusMessage = document.querySelector("#status");

const errors = {
  name: document.querySelector("#name-error"),
  email: document.querySelector("#email-error"),
  password: document.querySelector("#password-error"),
};

function showError(field, message) {
  errors[field].textContent = message;
}

function clearErrors() {
  Object.values(errors).forEach((error) => {
    error.textContent = "";
  });
  statusMessage.textContent = "";
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
        statusMessage.textContent = result.message || "No se pudo completar el registro.";
        return;
      }

      registrationForm.reset();
      statusMessage.textContent = `Cuenta creada para ${result.user.name}.`;
    } catch {
      statusMessage.textContent = "No se pudo conectar con el servidor.";
    }
  });
}
