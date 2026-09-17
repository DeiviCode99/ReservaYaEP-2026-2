const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const bcrypt = require("bcrypt");

const port = Number(process.env.PORT) || 3000;
const publicDirectory = __dirname;
const users = new Map();
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function sendJson(response, statusCode, body) {
  response.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(body));
}

function validateRegistration(payload) {
  const name = typeof payload.name === "string" ? payload.name.trim() : "";
  const email = typeof payload.email === "string" ? payload.email.trim().toLowerCase() : "";
  const password = typeof payload.password === "string" ? payload.password : "";

  if (name.length < 2 || name.length > 80) {
    return { error: "El nombre debe tener entre 2 y 80 caracteres." };
  }

  if (!emailPattern.test(email)) {
    return { error: "Introduce un correo electrónico válido." };
  }

  if (password.length < 8 || password.length > 72) {
    return { error: "La contraseña debe tener entre 8 y 72 caracteres." };
  }

  return { name, email, password };
}

function readRequestBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 10_000) {
        reject(new Error("Payload demasiado grande."));
        request.destroy();
      }
    });
    request.on("end", () => resolve(body));
    request.on("error", reject);
  });
}

async function registerUser(request, response) {
  try {
    const body = JSON.parse(await readRequestBody(request));
    const registration = validateRegistration(body);

    if (registration.error) {
      sendJson(response, 400, { message: registration.error });
      return;
    }

    if (users.has(registration.email)) {
      sendJson(response, 409, { message: "Ya existe una cuenta con ese correo." });
      return;
    }

    const passwordHash = await bcrypt.hash(registration.password, 12);
    const user = {
      id: crypto.randomUUID(),
      name: registration.name,
      email: registration.email,
      passwordHash,
      createdAt: new Date().toISOString(),
    };
    users.set(user.email, user);
    console.log(`Usuario registrado: ${user.email}. Total de usuarios en memoria: ${users.size}`);

    sendJson(response, 201, {
      message: "Registro completado correctamente.",
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (error) {
    const statusCode = error instanceof SyntaxError ? 400 : 500;
    sendJson(response, statusCode, {
      message: statusCode === 400 ? "El cuerpo de la solicitud no es JSON válido." : "Error interno del servidor.",
    });
  }
}

function listDebugUsers(response) {
  if (process.env.NODE_ENV === "production") {
    sendJson(response, 404, { message: "Recurso no encontrado." });
    return;
  }

  const safeUsers = [...users.values()].map(({ id, name, email, createdAt }) => ({
    id,
    name,
    email,
    createdAt,
  }));

  sendJson(response, 200, {
    count: safeUsers.length,
    users: safeUsers,
  });
}

function serveStaticFile(request, response) {
  const requestedPath = request.url === "/" ? "/index.html" : request.url;
  const filePath = path.resolve(publicDirectory, `.${requestedPath}`);

  if (!filePath.startsWith(publicDirectory) || !fs.existsSync(filePath)) {
    sendJson(response, 404, { message: "Recurso no encontrado." });
    return;
  }

  const contentTypes = {
    ".css": "text/css; charset=utf-8",
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
  };
  const contentType = contentTypes[path.extname(filePath)] || "application/octet-stream";
  response.writeHead(200, { "Content-Type": contentType });
  fs.createReadStream(filePath).pipe(response);
}

const server = http.createServer(async (request, response) => {
  if (request.method === "POST" && request.url === "/api/register") {
    await registerUser(request, response);
    return;
  }

  if (request.method === "GET" && request.url === "/api/debug/users") {
    listDebugUsers(response);
    return;
  }

  if (request.method === "GET") {
    serveStaticFile(request, response);
    return;
  }

  sendJson(response, 405, { message: "Método no permitido." });
});

server.listen(port, () => {
  console.log(`Servidor disponible en http://localhost:${port}`);
});
