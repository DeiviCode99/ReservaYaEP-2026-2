/* Modo demo (`npm run dev:demo`): responde las rutas /api/** con datos de
   ejemplo en memoria para poder ver el front sin levantar el backend.
   Solo se carga en desarrollo; no forma parte del build de producción.
   Imita las respuestas de los controllers reales (mismos campos y enums).
   Entrar: cualquier correo y contraseña. Si el correo contiene "admin" o
   "restaurante", la cuenta es de administrador. */

const iso = (offset) => {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 10);
};
const week = (open, close, closedDays = []) => [1, 2, 3, 4, 5, 6, 7].map((dayOfWeek) => ({
  id: dayOfWeek, dayOfWeek, openTime: `${open}:00`, closeTime: `${close}:00`, isClosed: closedDays.includes(dayOfWeek),
}));

const CLIENT = { id: 1, name: "Laura Gómez", email: "laura@ejemplo.com", role: "CLIENT", createdAt: new Date().toISOString() };
const ADMIN = { id: 2, name: "Carlos Rueda", email: "admin@ejemplo.com", role: "RESTAURANT_ADMIN", createdAt: new Date().toISOString() };
const OTHERS = { 11: ["Andrés Pinto", "andres@ejemplo.com"], 12: ["Marcela Ortiz", "marcela@ejemplo.com"], 13: ["Julián Serrano", "julian@ejemplo.com"] };

const restaurants = [
  { id: 1, ownerId: 2, name: "Doña Marta", cuisineType: "Santandereana", description: "Cabro, pepitoria y arepa de maíz pelado como en casa.", logoUrl: null },
  { id: 2, ownerId: 2, name: "La Brasa del Cañón", cuisineType: "Parrilla", description: "Carnes a la brasa con vista al Chicamocha.", logoUrl: null },
  { id: 3, ownerId: 9, name: "Masa Madre", cuisineType: "Pizzería", description: null, logoUrl: null },
  { id: 4, ownerId: 9, name: "Verde Limón", cuisineType: "Saludable", description: null, logoUrl: null },
  { id: 5, ownerId: 9, name: "Dulce Tentación", cuisineType: "Postres y café", description: null, logoUrl: null },
  { id: 6, ownerId: 9, name: "El Fogón Llanero", cuisineType: "Carnes", description: null, logoUrl: null },
];
const branches = [
  { id: 1, restaurantId: 1, name: "Sede Cabecera", address: "Cra 33 #45-10", city: "Bucaramanga", phone: "607 643 2211", capacity: 40, active: true, schedules: week("12:00", "22:00") },
  { id: 2, restaurantId: 1, name: "Sede Cañaveral", address: "Cl 30 #25-71", city: "Floridablanca", phone: "607 638 9040", capacity: 30, active: true, schedules: week("12:00", "21:00", [1]) },
  { id: 3, restaurantId: 2, name: "Sede Provenza", address: "Cl 105 #22-140", city: "Bucaramanga", phone: null, capacity: 60, active: true, schedules: week("17:00", "23:00") },
  { id: 4, restaurantId: 2, name: "Sede Girón Centro", address: "Cra 26 #30-15", city: "Girón", phone: "607 646 7788", capacity: 35, active: false, schedules: week("12:00", "20:00", [2]) },
  { id: 5, restaurantId: 3, name: "Sede Cacique", address: "Tv 93 #34-99", city: "Bucaramanga", phone: "607 697 1020", capacity: 25, active: true, schedules: week("16:00", "23:00") },
  { id: 6, restaurantId: 4, name: "Sede Piedecuesta", address: "Cra 6 #9-42", city: "Piedecuesta", phone: null, capacity: 20, active: true, schedules: week("08:00", "18:00", [7]) },
  { id: 7, restaurantId: 5, name: "Sede Lagos", address: "Cl 29 #9-30", city: "Floridablanca", phone: "607 619 3344", capacity: 18, active: true, schedules: week("09:00", "20:00") },
  { id: 8, restaurantId: 6, name: "Sede El Poblado", address: "Cl 43 #24-18", city: "Girón", phone: null, capacity: 45, active: true, schedules: week("11:00", "21:00") },
];
let nextId = 100;
const seed = (id, userId, branchId, day, time, partySize, status, event = "NONE", cancellationReason = null) => ({
  id, userId, branchId, reservationDate: iso(day), reservationTime: `${time}:00`, partySize, event,
  confirmationCode: `RY-${String(4810 + id * 37).toUpperCase()}`, status, cancellationReason,
  createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
});
const reservations = [
  seed(41, 1, 1, 2, "19:00", 4, "CONFIRMED", "BIRTHDAY"),
  seed(42, 1, 5, 5, "20:00", 2, "PENDING", "ROMANTIC_DINNER"),
  seed(38, 1, 3, -9, "20:00", 6, "COMPLETED"),
  seed(36, 1, 2, -20, "13:00", 3, "REJECTED", "NONE", "Ese día tuvimos un evento privado."),
  seed(35, 1, 7, -31, "16:00", 2, "CANCELLED", "NONE", "Cancelada por el cliente"),
  seed(43, 11, 1, 0, "13:00", 5, "PENDING", "BIRTHDAY"),
  seed(44, 12, 1, 0, "20:00", 2, "CONFIRMED", "ROMANTIC_DINNER"),
  seed(45, 13, 1, 1, "19:00", 8, "PENDING", "WEDDING"),
  seed(46, 11, 1, 3, "12:00", 3, "CANCELLED", "NONE", "Cancelada por el cliente"),
  seed(47, 12, 1, 4, "21:00", 4, "PENDING"),
  seed(48, 13, 3, 1, "20:00", 6, "PENDING"),
];

const HttpError = (status, message) => Object.assign(new Error(message), { status });
const branchView = (branch) => {
  const restaurant = restaurants.find((item) => item.id === branch.restaurantId);
  return { ...branch, restaurantName: restaurant.name, cuisineType: restaurant.cuisineType, latitude: null, longitude: null };
};
const includes = (text, query) => !query || String(text).toLowerCase().includes(query.toLowerCase());
const withCustomer = (reservation) => {
  const [customerName, customerEmail] = reservation.userId === CLIENT.id ? [CLIENT.name, CLIENT.email] : OTHERS[reservation.userId] || [null, null];
  return { ...reservation, customerName, customerEmail };
};
const booked = (branchId, date, time, exceptId) => reservations
  .filter((item) => item.branchId === branchId && item.reservationDate === date && item.reservationTime === time
    && ["PENDING", "CONFIRMED"].includes(item.status) && item.id !== exceptId)
  .reduce((sum, item) => sum + item.partySize, 0);

function availability(branchId, date) {
  const branch = branches.find((item) => item.id === branchId);
  if (!branch) throw HttpError(404, "La sede no existe.");
  const [year, month, day] = date.split("-").map(Number);
  const weekday = new Date(year, month - 1, day).getDay() || 7;
  const schedule = branch.schedules.find((item) => item.dayOfWeek === weekday);
  const slots = [];
  if (schedule && !schedule.isClosed) {
    const now = new Date();
    for (let hour = Number(schedule.openTime.slice(0, 2)); hour < Number(schedule.closeTime.slice(0, 2)); hour += 1) {
      const time = `${String(hour).padStart(2, "0")}:00:00`;
      if (new Date(`${date}T${time}`) <= now) continue;
      // Ocupación de ejemplo, estable por sede/día/hora, para que no todo se vea igual.
      const noise = ((branchId * 7 + day * 3 + hour * 5) % 9) * Math.ceil(branch.capacity / 10);
      slots.push({ time, available: Math.max(0, branch.capacity - booked(branchId, date, time) - (noise > branch.capacity ? branch.capacity : noise)) });
    }
  }
  return { branchId, date, capacity: branch.capacity, slots };
}

function saveReservation(body, user, existing) {
  const branch = branches.find((item) => item.id === Number(body.branchId));
  if (!branch || !branch.active) throw HttpError(400, "La sede no está disponible.");
  const time = body.reservationTime.length === 5 ? `${body.reservationTime}:00` : body.reservationTime;
  const slot = availability(branch.id, body.reservationDate).slots.find((item) => item.time === time);
  const free = (slot?.available || 0) + (existing && existing.reservationDate === body.reservationDate && existing.reservationTime === time ? existing.partySize : 0);
  if (!slot || body.partySize > free) throw HttpError(409, "Ese horario ya no tiene cupo suficiente.");
  const data = { branchId: branch.id, reservationDate: body.reservationDate, reservationTime: time, partySize: body.partySize, event: body.event || "NONE", status: "PENDING", updatedAt: new Date().toISOString() };
  if (existing) return Object.assign(existing, data);
  nextId += 1;
  const created = { ...seed(nextId, user.id, branch.id, 0, "00:00", 1, "PENDING"), ...data };
  reservations.push(created);
  return created;
}

function handle(method, url, body, user) {
  const path = url.pathname.replace(/\/+$/, "");
  const query = url.searchParams;
  const session = (account) => ({ token: `demo-${account.role}`, user: account });
  const needUser = () => { if (!user) throw HttpError(401, "Inicia sesión."); return user; };
  let match;

  if (path === "/api/auth/config") return { googleClientId: "" };
  if (path === "/api/auth/login" || path === "/api/auth/register") {
    const admin = body.role === "RESTAURANT_ADMIN" || /admin|restaurante/i.test(body.email || "");
    const account = admin ? ADMIN : CLIENT;
    if (body.name) account.name = body.name;
    return session(account);
  }
  if (path === "/api/auth/forgot-password") return { message: "Si el correo está registrado, te enviamos un enlace para recuperar tu cuenta." };
  if (path === "/api/auth/reset-password") return session(CLIENT);
  if (path === "/api/auth/me") return needUser();

  if (path === "/api/restaurants" && method === "GET") {
    if (query.get("mine") === "true") return restaurants.filter((item) => item.ownerId === needUser().id);
    return restaurants.filter((item) => includes(item.name, query.get("name")) && includes(item.cuisineType, query.get("cuisine")));
  }
  if (path === "/api/restaurants" && method === "POST") {
    nextId += 1;
    const created = { id: nextId, ownerId: needUser().id, logoUrl: null, ...body };
    restaurants.push(created);
    return created;
  }
  if ((match = path.match(/^\/api\/restaurants\/(\d+)$/)) && method === "PUT") {
    return Object.assign(restaurants.find((item) => item.id === Number(match[1])), body);
  }
  if (path === "/api/restaurants/branches") {
    return branches.map(branchView).filter((branch) => branch.active
      && includes(branch.restaurantName, query.get("name"))
      && (!query.get("city") || branch.city === query.get("city"))
      && includes(branch.cuisineType, query.get("cuisine")));
  }
  if ((match = path.match(/^\/api\/restaurants\/branches\/(\d+)$/))) {
    const branch = branches.find((item) => item.id === Number(match[1]));
    if (!branch) throw HttpError(404, "La sede no existe.");
    return branchView(branch);
  }
  if ((match = path.match(/^\/api\/restaurants\/(\d+)\/branches$/))) {
    const restaurantId = Number(match[1]);
    if (method === "GET") return branches.filter((branch) => branch.restaurantId === restaurantId).map(branchView);
    nextId += 1;
    const created = { id: nextId, restaurantId, ...body };
    branches.push(created);
    return branchView(created);
  }
  if ((match = path.match(/^\/api\/restaurants\/(\d+)\/branches\/(\d+)$/)) && method === "PUT") {
    return branchView(Object.assign(branches.find((item) => item.id === Number(match[2])), body));
  }

  if (path === "/api/reservations/availability") {
    needUser();
    return availability(Number(query.get("branchId")), query.get("date"));
  }
  if (path === "/api/reservations" && method === "GET") {
    needUser();
    if (!query.get("branchId")) return reservations.filter((item) => item.userId === user.id);
    const from = query.get("date") || query.get("from") || "0000";
    const to = query.get("date") || query.get("to") || "9999";
    return reservations
      .filter((item) => item.branchId === Number(query.get("branchId")) && item.reservationDate >= from && item.reservationDate <= to
        && (!query.get("status") || item.status === query.get("status")))
      .map(withCustomer);
  }
  if (path === "/api/reservations" && method === "POST") return saveReservation(body, needUser(), null);
  if ((match = path.match(/^\/api\/reservations\/(\d+)(\/status)?$/))) {
    needUser();
    const reservation = reservations.find((item) => item.id === Number(match[1]));
    if (!reservation) throw HttpError(404, "La reserva no existe.");
    if (method === "PUT") return saveReservation(body, user, reservation);
    if (method === "PATCH") {
      return Object.assign(reservation, {
        status: match[2] ? body.status : "CANCELLED",
        cancellationReason: body?.cancellationReason || null,
        updatedAt: new Date().toISOString(),
      });
    }
  }
  throw HttpError(404, "Ruta no disponible en el modo demo.");
}

export function installDemoApi() {
  const realFetch = window.fetch.bind(window);
  window.fetch = async (input, options = {}) => {
    const url = new URL(typeof input === "string" ? input : input.url, window.location.origin);
    if (!url.pathname.startsWith("/api/")) return realFetch(input, options);
    await new Promise((resolve) => { window.setTimeout(resolve, 450); });
    const token = String(options.headers?.Authorization || "");
    const user = token.includes("RESTAURANT_ADMIN") ? ADMIN : token.includes("CLIENT") ? CLIENT : null;
    try {
      const body = options.body ? JSON.parse(options.body) : null;
      const data = handle((options.method || "GET").toUpperCase(), url, body, user);
      return new Response(JSON.stringify(data), { status: 200, headers: { "Content-Type": "application/json" } });
    } catch (error) {
      return new Response(JSON.stringify({ message: error.message }), { status: error.status || 500, headers: { "Content-Type": "application/json" } });
    }
  };
  console.info("[ReservaYa] Modo demo: datos de ejemplo en memoria, sin backend.");
}
