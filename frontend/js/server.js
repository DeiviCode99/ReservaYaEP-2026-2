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
const reservations = new Map();

const weekDays = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];
const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;
const reservationEvents = ["ninguno", "cena romantica", "cumpleaños", "grados", "boda"];

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

function seedDemoRestaurants() {
  if (restaurants.size > 0) return;

  const demoRestaurants = [
    ["Doña Marta Cabecera", "Carrera 35 #48-72, Bucaramanga", "Colombiana", 42],
    ["Doña Marta San Francisco", "Calle 42 #29-18, Bucaramanga", "Santandereana", 36],
    ["Doña Marta Floridablanca", "Carrera 26 #200-15, Floridablanca", "Colombiana", 50],
    ["Doña Marta El Cacique", "Calle 93 #34-60, Bucaramanga", "Fusión", 28],
    ["Doña Marta Piedecuesta", "Carrera 15 #5-41, Piedecuesta", "Típica", 32],
    ["Doña Marta Girón Colonial", "Carrera 26 #31-09, Girón", "Santandereana", 40],
    ["Doña Marta La 56", "Calle 56 #18-33, Bucaramanga", "Parrilla", 45],
    ["Doña Marta Jardín", "Carrera 27 #110-20, Floridablanca", "Vegetariana", 24],
    ["Doña Marta Girón Centro", "Calle 30 #27-55, Girón", "Colombiana", 30],
    ["Doña Marta La Montaña", "Carrera 7 #10-26, Piedecuesta", "Típica", 38],
  ];
  const schedules = weekDays.map((day) => ({ day, open: "12:00", close: "22:00", closed: false }));

  demoRestaurants.forEach(([name, address, cuisineType, maxCapacity], index) => {
    const now = new Date().toISOString();
    restaurants.set(`demo-${index + 1}`, {
      id: `demo-${index + 1}`,
      adminId: "demo-admin",
      name,
      address,
      cuisineType,
      maxCapacity,
      schedules: schedules.map((schedule) => ({ ...schedule })),
      createdAt: now,
      updatedAt: now,
    });
  });
}

function normalizeSearchValue(value) {
  return typeof value === "string" ? value.trim().toLocaleLowerCase("es") : "";
}

function listPublicRestaurants(url) {
  const location = normalizeSearchValue(url.searchParams.get("location"));
  const cuisine = normalizeSearchValue(url.searchParams.get("cuisine"));
  const requestedPage = Number(url.searchParams.get("page") || 1);
  const requestedLimit = Number(url.searchParams.get("limit") || 6);
  const page = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const limit = Number.isInteger(requestedLimit) && requestedLimit > 0
    ? Math.min(requestedLimit, 20)
    : 6;

  const filtered = [...restaurants.values()].filter((restaurant) => {
    const matchesLocation = !location || normalizeSearchValue(restaurant.address).includes(location);
    const matchesCuisine = !cuisine || normalizeSearchValue(restaurant.cuisineType).includes(cuisine);
    return matchesLocation && matchesCuisine;
  });

  const start = (page - 1) * limit;
  return {
    page,
    limit,
    total: filtered.length,
    totalPages: Math.max(1, Math.ceil(filtered.length / limit)),
    restaurants: filtered.slice(start, start + limit).map(publicRestaurant),
  };
}

function getDaySchedule(restaurant, date) {
  const dayIndex = new Date(`${date}T12:00:00`).getDay();
  const scheduleIndex = dayIndex === 0 ? 6 : dayIndex - 1;
  return restaurant.schedules[scheduleIndex];
}

function buildTimeSlots(open, close) {
  const slots = [];
  let [hour, minute] = open.split(":").map(Number);
  const [closeHour, closeMinute] = close.split(":").map(Number);

  while (hour < closeHour || (hour === closeHour && minute < closeMinute)) {
    const nextHour = hour + 1;
    if (nextHour > closeHour || (nextHour === closeHour && minute > closeMinute)) break;
    slots.push(`${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`);
    hour = nextHour;
  }

  return slots;
}

function getAvailability(restaurant, date) {
  const schedule = getDaySchedule(restaurant, date);
  if (!schedule || schedule.closed) return [];

  return buildTimeSlots(schedule.open, schedule.close).map((time) => {
    const reservedPeople = [...reservations.values()]
      .filter((reservation) =>
        reservation.restaurantId === restaurant.id &&
        reservation.date === date &&
        reservation.time === time &&
        reservation.status === "confirmed",
      )
      .reduce((total, reservation) => total + reservation.partySize, 0);

    return {
      time,
      capacity: restaurant.maxCapacity,
      reservedPeople,
      availablePeople: Math.max(restaurant.maxCapacity - reservedPeople, 0),
      available: reservedPeople < restaurant.maxCapacity,
    };
  });
}

function validateReservation(payload) {
  const userId = typeof payload.userId === "string" ? payload.userId : "";
  const restaurantId = typeof payload.restaurantId === "string" ? payload.restaurantId : "";
  const date = typeof payload.date === "string" ? payload.date : "";
  const time = typeof payload.time === "string" ? payload.time : "";
  const event = typeof payload.event === "string" ? payload.event.trim().toLocaleLowerCase("es") : "";
  const partySize = typeof payload.partySize === "string" ? Number(payload.partySize) : payload.partySize;

  const user = [...users.values()].find((item) => item.id === userId);
  const restaurant = restaurants.get(restaurantId);
  if (!user) return { error: "Debes registrarte antes de reservar." };
  if (!restaurant) return { error: "La sede seleccionada no existe." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { error: "Selecciona una fecha válida." };
  if (date < new Date().toISOString().slice(0, 10)) return { error: "La fecha no puede estar en el pasado." };
  if (!timePattern.test(time)) return { error: "Selecciona un horario válido." };
  if (!reservationEvents.includes(event)) return { error: "Selecciona un evento válido." };
  if (!Number.isInteger(partySize) || partySize < 1 || partySize > 50) {
    return { error: "El número de personas debe estar entre 1 y 50." };
  }

  const slot = getAvailability(restaurant, date).find((entry) => entry.time === time);
  if (!slot || !slot.available || slot.availablePeople < partySize) {
    return { error: "No hay cupos suficientes para ese horario." };
  }

  return {
    user,
    restaurant,
    userId,
    restaurantId,
    date,
    time,
    partySize,
    event,
    depositAmount: partySize <= 3 ? 50000 : 100000,
  };
}

function getRestaurantAvailability(request, response, id, url) {
  const restaurant = restaurants.get(id);
  const date = url.searchParams.get("date") || "";

  if (!restaurant) {
    sendJson(response, 404, { message: "Sede no encontrada." });
    return;
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    sendJson(response, 400, { message: "Indica una fecha con formato YYYY-MM-DD." });
    return;
  }

  sendJson(response, 200, {
    restaurant: publicRestaurant(restaurant),
    date,
    slots: getAvailability(restaurant, date),
  });
}

async function createReservation(request, response) {
  try {
    const body = JSON.parse(await readRequestBody(request));
    const reservation = validateReservation(body);

    if (reservation.error) {
      sendJson(response, 400, { message: reservation.error });
      return;
    }

    const record = {
      id: crypto.randomUUID(),
      userId: reservation.userId,
      restaurantId: reservation.restaurantId,
      date: reservation.date,
      time: reservation.time,
      partySize: reservation.partySize,
      event: reservation.event,
      depositAmount: reservation.depositAmount,
      status: "confirmed",
      createdAt: new Date().toISOString(),
    };
    reservations.set(record.id, record);
    console.log(`Reserva creada: ${record.id}. Total en memoria: ${reservations.size}`);

    const ticket = {
      id: record.id,
      status: record.status,
      customerName: reservation.user.name,
      customerEmail: reservation.user.email,
      restaurantName: reservation.restaurant.name,
      restaurantAddress: reservation.restaurant.address,
      date: record.date,
      time: record.time,
      partySize: record.partySize,
      event: record.event,
      depositAmount: record.depositAmount,
      depositCurrency: "COP",
      createdAt: record.createdAt,
    };

    sendJson(response, 201, {
      message: "Reserva confirmada correctamente.",
      reservation: ticket,
      ticket,
    });
  } catch (error) {
    const statusCode = error instanceof SyntaxError ? 400 : 500;
    sendJson(response, statusCode, {
      message: statusCode === 400 ? "El cuerpo de la solicitud no es JSON válido." : "Error interno del servidor.",
    });
  }
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
  const filePath = path.resolve(publicDirectory, `.${requestedPath}`);

  if (!filePath.startsWith(publicDirectory) || !fs.existsSync(filePath)) {
    sendJson(response, 404, { message: "Recurso no encontrado." });
    return;
  }

  const contentTypes = {
    ".css": "text/css; charset=utf-8",
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".svg": "image/svg+xml",
    ".webp": "image/webp",
  };
  const contentType = contentTypes[path.extname(filePath)] || "application/octet-stream";
  response.writeHead(200, { "Content-Type": contentType });
  fs.createReadStream(filePath).pipe(response);
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

  if (request.method === "GET" && url.pathname === "/api/restaurants/search") {
    sendJson(response, 200, listPublicRestaurants(url));
    return;
  }

  const availabilityRoute = url.pathname.match(/^\/api\/restaurants\/([^/]+)\/availability$/);
  if (request.method === "GET" && availabilityRoute) {
    getRestaurantAvailability(request, response, availabilityRoute[1], url);
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/reservations") {
    await createReservation(request, response);
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

seedDemoRestaurants();

server.listen(port, () => {
  console.log(`Servidor disponible en http://localhost:${port}`);
});
