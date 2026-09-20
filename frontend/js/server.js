const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const bcrypt = require("bcrypt");

const port = Number(process.env.PORT) || 3000;
const publicDirectory = path.resolve(__dirname, "..");
const users = new Map();
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const restaurants = new Map();
const admins = new Map();
const adminSessions = new Map();

const weekDays = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];
const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;

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

function validateRestaurant(payload) {
  const name = typeof payload.name === "string" ? payload.name.trim() : "";
  const address = typeof payload.address === "string" ? payload.address.trim() : "";
  const cuisineType = typeof payload.cuisineType === "string" ? payload.cuisineType.trim() : "";
  const maxCapacity =
    typeof payload.maxCapacity === "string" ? Number(payload.maxCapacity) : payload.maxCapacity;
  const schedules = Array.isArray(payload.schedules) ? payload.schedules : null;

  if (name.length < 2 || name.length > 80) {
    return { error: "El nombre del restaurante debe tener entre 2 y 80 caracteres." };
  }

  if (address.length < 5 || address.length > 150) {
    return { error: "La dirección debe tener entre 5 y 150 caracteres." };
  }

  if (cuisineType.length < 2 || cuisineType.length > 60) {
    return { error: "El tipo de cocina debe tener entre 2 y 60 caracteres." };
  }

  if (!Number.isInteger(maxCapacity) || maxCapacity < 1 || maxCapacity > 500) {
    return { error: "La capacidad máxima debe ser un número entero entre 1 y 500." };
  }

  if (!schedules || schedules.length !== 7) {
    return { error: "Se deben suministrar los horarios de los 7 días de la semana." };
  }

  const normalizedSchedules = [];
  let openDays = 0;

  for (let index = 0; index < 7; index += 1) {
    const entry = schedules[index] || {};
    const open = typeof entry.open === "string" ? entry.open : "";
    const close = typeof entry.close === "string" ? entry.close : "";
    const closed = entry.closed === true;

    if (!timePattern.test(open) || !timePattern.test(close)) {
      return { error: "Los horarios deben tener formato HH:MM." };
    }

    if (open >= close) {
      return {
        error: `El horario del ${weekDays[index]} es inválido: la apertura debe ser antes del cierre.`,
      };
    }

    if (!closed) {
      openDays += 1;
    }

    normalizedSchedules.push({ day: weekDays[index], open, close, closed });
  }

  if (openDays === 0) {
    return { error: "El restaurante debe tener al menos un día abierto." };
  }

  return { name, address, cuisineType, maxCapacity, schedules: normalizedSchedules };
}

function publicRestaurant(record) {
  const { id, name, address, cuisineType, maxCapacity, schedules, createdAt, updatedAt } = record;
  return { id, name, address, cuisineType, maxCapacity, schedules, createdAt, updatedAt };
}

function getAdminId(request) {
  const header = request.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  return adminSessions.get(token) || null;
}

async function createAdminSession(request, response) {
  try {
    const rawBody = await readRequestBody(request);
    let name = "Administrador Demo";

    if (rawBody) {
      try {
        const body = JSON.parse(rawBody);
        if (typeof body.name === "string" && body.name.trim()) {
          name = body.name.trim().slice(0, 40);
        }
      } catch {
        // El nombre es opcional; se ignora un cuerpo inválido.
      }
    }

    let admin = admins.get("demo-admin");
    if (!admin) {
      admin = { id: "demo-admin", name, createdAt: new Date().toISOString() };
      admins.set(admin.id, admin);
    } else {
      admin.name = name;
    }

    const token = crypto.randomUUID();
    adminSessions.set(token, admin.id);
    console.log(`Sesión admin simulada iniciada para "${admin.name}". Sesiones activas: ${adminSessions.size}`);

    sendJson(response, 200, {
      message: "Sesión de administrador iniciada.",
      token,
      admin: { id: admin.id, name: admin.name },
    });
  } catch {
    sendJson(response, 500, { message: "Error interno del servidor." });
  }
}

function listAdminRestaurants(request, response) {
  const adminId = getAdminId(request);
  if (!adminId) {
    sendJson(response, 401, { message: "Se requiere una sesión de administrador." });
    return;
  }

  const items = [...restaurants.values()]
    .filter((record) => record.adminId === adminId)
    .map(publicRestaurant);

  sendJson(response, 200, { count: items.length, restaurants: items });
}

async function createRestaurant(request, response) {
  const adminId = getAdminId(request);
  if (!adminId) {
    sendJson(response, 401, { message: "Se requiere una sesión de administrador." });
    return;
  }

  try {
    const body = JSON.parse(await readRequestBody(request));
    const restaurant = validateRestaurant(body);

    if (restaurant.error) {
      sendJson(response, 400, { message: restaurant.error });
      return;
    }

    const record = {
      id: crypto.randomUUID(),
      adminId,
      ...restaurant,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    restaurants.set(record.id, record);
    console.log(`Restaurante registrado: "${record.name}". Total en memoria: ${restaurants.size}`);

    sendJson(response, 201, {
      message: "Restaurante registrado correctamente.",
      restaurant: publicRestaurant(record),
    });
  } catch (error) {
    const statusCode = error instanceof SyntaxError ? 400 : 500;
    sendJson(response, statusCode, {
      message:
        statusCode === 400 ? "El cuerpo de la solicitud no es JSON válido." : "Error interno del servidor.",
    });
  }
}

function handleRestaurantOwnership(request, response, id) {
  const adminId = getAdminId(request);
  if (!adminId) {
    return { error: { statusCode: 401, message: "Se requiere una sesión de administrador." } };
  }

  const record = restaurants.get(id);
  if (!record || record.adminId !== adminId) {
    return { error: { statusCode: 404, message: "Restaurante no encontrado." } };
  }

  return { record };
}

async function updateRestaurant(request, response, id) {
  const ownership = handleRestaurantOwnership(request, response, id);
  if (ownership.error) {
    sendJson(response, ownership.error.statusCode, { message: ownership.error.message });
    return;
  }

  try {
    const body = JSON.parse(await readRequestBody(request));
    const restaurant = validateRestaurant(body);

    if (restaurant.error) {
      sendJson(response, 400, { message: restaurant.error });
      return;
    }

    const record = { ...ownership.record, ...restaurant, updatedAt: new Date().toISOString() };
    restaurants.set(id, record);
    console.log(`Restaurante actualizado: "${record.name}".`);

    sendJson(response, 200, {
      message: "Restaurante actualizado correctamente.",
      restaurant: publicRestaurant(record),
    });
  } catch (error) {
    const statusCode = error instanceof SyntaxError ? 400 : 500;
    sendJson(response, statusCode, {
      message:
        statusCode === 400 ? "El cuerpo de la solicitud no es JSON válido." : "Error interno del servidor.",
    });
  }
}

function deleteRestaurant(request, response, id) {
  const ownership = handleRestaurantOwnership(request, response, id);
  if (ownership.error) {
    sendJson(response, ownership.error.statusCode, { message: ownership.error.message });
    return;
  }

  restaurants.delete(id);
  console.log(`Restaurante eliminado: "${ownership.record.name}". Total en memoria: ${restaurants.size}`);
  sendJson(response, 200, { message: "Restaurante eliminado correctamente." });
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

function serveStaticFile(response, pathname) {
  const requestedPath = pathname === "/" ? "/html/index.html" : pathname;
  let filePath = path.resolve(publicDirectory, `.${requestedPath}`);

  if (!filePath.startsWith(publicDirectory) || !fs.existsSync(filePath)) {
    sendJson(response, 404, { message: "Recurso no encontrado." });
    return;
  }

  // Una carpeta (por ejemplo "/html/") se sirve con su index.html.
  if (fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, "index.html");
    if (!fs.existsSync(filePath)) {
      sendJson(response, 404, { message: "Recurso no encontrado." });
      return;
    }
  }

  const contentTypes = {
    ".css": "text/css; charset=utf-8",
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".svg": "image/svg+xml",
    ".webp": "image/webp",
    ".ico": "image/x-icon",
    ".woff2": "font/woff2",
  };
  const contentType = contentTypes[path.extname(filePath)] || "application/octet-stream";
  response.writeHead(200, { "Content-Type": contentType });

  const stream = fs.createReadStream(filePath);
  stream.on("error", () => response.destroy());
  stream.pipe(response);
}

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host || "localhost"}`);

  if (request.method === "POST" && url.pathname === "/api/register") {
    await registerUser(request, response);
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/demo/login") {
    await createAdminSession(request, response);
    return;
  }

  if (url.pathname === "/api/restaurants") {
    if (request.method === "GET") {
      listAdminRestaurants(request, response);
      return;
    }

    if (request.method === "POST") {
      await createRestaurant(request, response);
      return;
    }

    sendJson(response, 405, { message: "Método no permitido." });
    return;
  }

  const restaurantRoute = url.pathname.match(/^\/api\/restaurants\/([^/]+)$/);
  if (restaurantRoute) {
    const id = restaurantRoute[1];

    if (request.method === "PUT") {
      await updateRestaurant(request, response, id);
      return;
    }

    if (request.method === "DELETE") {
      deleteRestaurant(request, response, id);
      return;
    }

    sendJson(response, 405, { message: "Método no permitido." });
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/debug/users") {
    listDebugUsers(response);
    return;
  }

  if (request.method === "GET") {
    serveStaticFile(response, url.pathname);
    return;
  }

  sendJson(response, 405, { message: "Método no permitido." });
});

server.listen(port, () => {
  console.log(`Servidor disponible en http://localhost:${port}`);
});
