import React, { useCallback, useEffect, useState } from "react";
import { jsPDF } from "jspdf";
import { apiFetch, EVENTS, formatDate, getUser, todayIso } from "./api";
import { Badge, Layout, Notifications, Status } from "./components";

const CITIES = ["Bucaramanga", "Floridablanca", "Girón", "Piedecuesta"];
const STATUS_MESSAGES = { CONFIRMED: "fue confirmada", REJECTED: "fue rechazada", COMPLETED: "quedó como completada" };

function reservationIsActive(reservation) {
  return ["PENDING", "CONFIRMED"].includes(reservation.status)
    && new Date(`${reservation.reservationDate}T${reservation.reservationTime}`) > new Date();
}

function downloadConfirmation(reservation) {
  const pdf = new jsPDF();
  const code = reservation.confirmationCode || `RESERVA-${reservation.id}`;
  pdf.setTextColor(107, 22, 38);
  pdf.setFontSize(22);
  pdf.text("ReservaYa", 20, 25);
  pdf.setTextColor(38, 22, 26);
  pdf.setFontSize(16);
  pdf.text("Confirmación de reserva", 20, 42);
  pdf.setFontSize(11);
  pdf.text(`Código: ${code}`, 20, 58);
  pdf.text(`Sede: ${reservation.branchName || "No disponible"}`, 20, 70);
  pdf.text(`Fecha: ${formatDate(reservation.reservationDate)}`, 20, 82);
  pdf.text(`Hora: ${String(reservation.reservationTime).slice(0, 5)}`, 20, 94);
  pdf.text(`Personas: ${reservation.partySize}`, 20, 106);
  pdf.text(`Ocasión: ${EVENTS[reservation.event] || "Ninguna"}`, 20, 118);
  pdf.text(`Estado: ${reservation.status}`, 20, 130);
  pdf.setDrawColor(233, 178, 60);
  pdf.line(20, 140, 190, 140);
  pdf.setFontSize(10);
  pdf.setTextColor(124, 102, 107);
  pdf.text("Presenta este código al restaurante.", 20, 153);
  pdf.save(`reserva-${code}.pdf`);
}

function ReservationCard({ reservation, onChange, onEdit, onFeedback }) {
  const active = reservationIsActive(reservation);
  async function cancel() {
    if (!window.confirm(`¿Cancelar la reserva #${reservation.id}? Esta acción no se puede deshacer.`)) return;
    try {
      await apiFetch(`/api/reservations/${reservation.id}`, { method: "PATCH", body: JSON.stringify({ cancellationReason: "Cancelada por el cliente" }) });
      await onChange();
      onFeedback(`La reserva #${reservation.id} fue cancelada correctamente.`, "success");
    } catch (error) { onFeedback(error.message, "error"); }
  }
  return <li className="restaurant-card"><div className="restaurant-card-head"><h3>{reservation.branchName || `Reserva #${reservation.id}`}</h3><Badge status={reservation.status} /></div><p className="restaurant-address">{formatDate(reservation.reservationDate)} a las {String(reservation.reservationTime).slice(0, 5)}</p><p className="restaurant-meta">Para {reservation.partySize} personas · ocasión: {EVENTS[reservation.event] || "Ninguna"}</p><p className="restaurant-meta">Código: <strong>{reservation.confirmationCode || `RESERVA-${reservation.id}`}</strong></p>{reservation.cancellationReason && <p className="restaurant-meta">Motivo: {reservation.cancellationReason}</p>}<div className="restaurant-actions">{active && <><button className="button button-small button-outline" onClick={() => onEdit(reservation)}>Modificar</button><button className="button button-small button-danger" onClick={cancel}>Cancelar</button></>}<button className="button button-small button-outline" onClick={() => downloadConfirmation(reservation)}>Descargar confirmación</button></div></li>;
}

export function Client() {
  const user = getUser();
  if (!user || user.role !== "CLIENT") {
    window.location.replace("/login");
    return null;
  }
  const [branches, setBranches] = useState([]);
  const [reservations, setReservations] = useState([]);
  const [query, setQuery] = useState({ name: "", city: "", cuisine: "" });
  const [selected, setSelected] = useState(null);
  const [editing, setEditing] = useState(null);
  const [date, setDate] = useState(todayIso());
  const [party, setParty] = useState(2);
  const [event, setEvent] = useState("NONE");
  const [slots, setSlots] = useState([]);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [status, setStatus] = useState({ message: "", tone: "" });
  const [knownStatuses, setKnownStatuses] = useState({});

  const feedback = (message, tone = "") => setStatus({ message, tone });
  const loadReservations = useCallback(async () => {
    const data = await apiFetch("/api/reservations");
    if (!Array.isArray(data)) throw new Error("El servidor devolvió un formato de reservas inválido.");
    const named = await Promise.all(data.map(async (reservation) => {
      try {
        const branch = await apiFetch(`/api/restaurants/branches/${reservation.branchId}`);
        return { ...reservation, branchName: `${branch.restaurantName} · ${branch.name}` };
      } catch { return reservation; }
    }));
    setReservations(named);
    return named;
  }, []);

  useEffect(() => { loadReservations().catch((error) => feedback(error.message, "error")); }, [loadReservations]);
  const checkStatusChanges = useCallback(async () => {
    const current = await apiFetch("/api/reservations");
    const previous = knownStatuses;
    setKnownStatuses(Object.fromEntries(current.map((reservation) => [reservation.id, reservation.status])));
    const changed = current.filter((reservation) => previous[reservation.id] && previous[reservation.id] !== reservation.status && STATUS_MESSAGES[reservation.status]);
    if (changed.length) await loadReservations();
    return changed.map((reservation) => `Tu reserva #${reservation.id} ${STATUS_MESSAGES[reservation.status]}.`);
  }, [knownStatuses, loadReservations]);
  async function search(eventObject) {
    eventObject?.preventDefault();
    const params = new URLSearchParams(Object.entries(query).filter(([, value]) => value));
    feedback("Buscando sedes...");
    try {
      const result = await apiFetch(`/api/restaurants/branches?${params}`);
      setBranches(result);
      feedback(result.length ? `${result.length} sede(s) encontrada(s).` : "No encontramos sedes con esos filtros.", result.length ? "success" : "error");
    } catch (error) { feedback(error.message, "error"); }
  }
  async function chooseBranch(branch, reservationToEdit = null) {
    setSelected(branch); setEditing(reservationToEdit); setSelectedSlot(null); setSlots([]);
    if (reservationToEdit) {
      setDate(reservationToEdit.reservationDate < todayIso() ? todayIso() : reservationToEdit.reservationDate);
      setParty(reservationToEdit.partySize); setEvent(reservationToEdit.event || "NONE");
    }
    try {
      const data = await apiFetch(`/api/reservations/availability?branchId=${branch.id}&date=${reservationToEdit?.reservationDate || date}`);
      const available = data.slots.filter((slot) => slot.available > 0).map((slot) => reservationToEdit && slot.time === reservationToEdit.reservationTime && reservationToEdit.reservationDate === date ? { ...slot, available: slot.available + reservationToEdit.partySize } : slot);
      setSlots(available);
      if (reservationToEdit) setSelectedSlot(available.find((slot) => slot.time === reservationToEdit.reservationTime) || null);
    } catch (error) { feedback(error.message, "error"); }
  }
  async function reloadSlots() { if (selected) await chooseBranch(selected, editing); }
  async function saveReservation(eventObject) {
    eventObject.preventDefault();
    if (!selectedSlot) return feedback("Elige un horario con cupo.", "error");
    try {
      const path = editing ? `/api/reservations/${editing.id}` : "/api/reservations";
      await apiFetch(path, { method: editing ? "PUT" : "POST", body: JSON.stringify({ branchId: selected.id, reservationDate: date, reservationTime: selectedSlot.time, partySize: Number(party), event }) });
      feedback(editing ? "Reserva modificada correctamente." : "Reserva creada. Queda pendiente hasta que el restaurante la confirme.", "success");
      setSelected(null); setEditing(null); await loadReservations();
    } catch (error) { feedback(error.message, "error"); }
  }
  const active = reservations.filter(reservationIsActive);
  const history = reservations.filter((reservation) => !reservationIsActive(reservation));
  const upcoming = [...active].sort((a, b) => `${a.reservationDate}${a.reservationTime}`.localeCompare(`${b.reservationDate}${b.reservationTime}`))[0];
  return <Layout notificationCheck={checkStatusChanges}><div className="page-head"><h1>Mis reservas</h1><p className="page-lead">Revisa lo que tienes reservado, cancela si cambian tus planes y consulta tu historial.</p></div><Status message={status.message} tone={status.tone} /><section className="summary" aria-label="Resumen de tus reservas"><div className="summary-item"><span className="summary-value">{active.length}</span><span className="summary-label">Reservas activas</span></div><div className="summary-item"><span className="summary-value">{upcoming ? formatDate(upcoming.reservationDate) : "—"}</span><span className="summary-label">Tu próxima reserva</span></div><div className="summary-item"><span className="summary-value">{history.length}</span><span className="summary-label">Reservas en el historial</span></div></section><section className="panel booking"><h2>Reservar una mesa</h2><p className="panel-note">Dos pasos: elige la sede y luego el día, la hora y cuántos van.</p><div className="booking-step-first"><h3 className="step-title"><span className="step-number">1</span> Elige la sede</h3><form className="search-form" onSubmit={search}><div><label>Restaurante</label><input type="search" placeholder="Ej. Doña Marta" value={query.name} onChange={(e) => setQuery({ ...query, name: e.target.value })} /></div><div><label>Ubicación</label><select value={query.city} onChange={(e) => { setQuery({ ...query, city: e.target.value }); search(); }}><option value="">Todo el área metropolitana</option>{CITIES.map((city) => <option key={city}>{city}</option>)}</select></div><div><label>Tipo de cocina</label><input type="search" placeholder="Ej. Santandereana" value={query.cuisine} onChange={(e) => setQuery({ ...query, cuisine: e.target.value })} /></div><button className="button">Buscar</button></form><ul className="restaurant-list result-grid">{branches.map((branch) => <li className="restaurant-card" key={branch.id}><h3>{branch.restaurantName}</h3><p className="restaurant-address">{branch.name} · {branch.address}, {branch.city}</p><p className="restaurant-meta">Cocina {branch.cuisineType} · aforo {branch.capacity} personas por franja</p><button className="button button-small" type="button" onClick={() => chooseBranch(branch)}>Reservar aquí</button></li>)}</ul></div>{selected && <form className="booking-step" onSubmit={saveReservation}><h3 className="step-title"><span className="step-number">2</span> {editing ? `Modificar reserva #${editing.id}` : "Día, hora y personas"}</h3><p className="restaurant-meta">{selected.restaurantName} · {selected.name} ({selected.address}, {selected.city})</p><div className="booking-fields"><div><label>Fecha</label><input type="date" min={todayIso()} value={date} onChange={(e) => { setDate(e.target.value); setTimeout(reloadSlots, 0); }} required /></div><div><label>Personas</label><input type="number" min="1" max={Math.min(selectedSlot?.available || 50, 50)} value={party} onChange={(e) => setParty(e.target.value)} required /></div><div><label>Ocasión</label><select value={event} onChange={(e) => setEvent(e.target.value)}>{Object.entries(EVENTS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></div></div><p className="field-hint">Abono requerido: {(Number(party) <= 3 ? 50000 : 100000).toLocaleString("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 })}</p><p className="step-label">Horarios con cupo</p><div className="slot-list">{slots.map((slot) => <button className="slot-button" type="button" aria-pressed={selectedSlot?.time === slot.time} key={slot.time} onClick={() => setSelectedSlot(slot)}><strong>{String(slot.time).slice(0, 5)}</strong><small>{slot.available} {slot.available === 1 ? "cupo" : "cupos"}</small></button>)}</div><div className="form-actions"><button className="button" disabled={!selectedSlot}>{editing ? "Guardar cambios" : "Confirmar reserva"}</button><button className="button button-outline" type="button" onClick={() => { setSelected(null); setEditing(null); }}>No modificar</button></div></form>}</section><div className="dashboard-grid"><ReservationList title="Reservas activas" items={active} onChange={loadReservations} onEdit={(reservation) => apiFetch(`/api/restaurants/branches/${reservation.branchId}`).then((branch) => chooseBranch(branch, reservation))} onFeedback={feedback} /><ReservationList title="Historial" items={history} onChange={loadReservations} onEdit={() => {}} onFeedback={feedback} /></div></Layout>;
}

function ReservationList({ title, items, onChange, onEdit, onFeedback }) {
  return <section className="panel"><h2>{title}</h2><div className="empty-state" hidden={items.length > 0}><img className="empty-art" src={`/images/${title === "Historial" ? "vacio-restaurantes.svg" : "vacio-reservas.svg"}`} alt="" /><p className="empty-text">{title === "Historial" ? "Aquí quedarán tus reservas completadas, canceladas o rechazadas." : "Todavía no tienes reservas. Busca un restaurante y aparta tu mesa."}</p></div><ul className="restaurant-list">{items.map((reservation) => <ReservationCard key={reservation.id} reservation={reservation} onChange={onChange} onEdit={onEdit} onFeedback={onFeedback} />)}</ul></section>;
}

export function Locations() {
  const [filters, setFilters] = useState({ city: "", cuisine: "" });
  const [branches, setBranches] = useState([]);
  const [status, setStatus] = useState("");
  const [selected, setSelected] = useState(null);
  const [date, setDate] = useState(todayIso());
  const [slots, setSlots] = useState([]);
  const [slot, setSlot] = useState(null);
  const [party, setParty] = useState(2);
  const [event, setEvent] = useState("NONE");
  const user = getUser();

  async function search(eventObject) {
    eventObject?.preventDefault();
    try {
      const params = new URLSearchParams(Object.entries(filters).filter(([, value]) => value));
      const result = await apiFetch(`/api/restaurants/branches?${params}`);
      setBranches(Array.isArray(result) ? result : []);
      setStatus("");
    } catch (error) { setStatus(error.message); }
  }
  async function choose(branch) {
    if (!user) return setStatus("Inicia sesión o crea tu cuenta para reservar.");
    setSelected(branch);
    try {
      const result = await apiFetch(`/api/reservations/availability?branchId=${branch.id}&date=${date}`);
      setSlots(result.slots.filter((item) => item.available > 0));
    } catch (error) { setStatus(error.message); }
  }
  async function reserve(eventObject) {
    eventObject.preventDefault();
    if (!slot) return;
    try {
      await apiFetch("/api/reservations", { method: "POST", body: JSON.stringify({ branchId: selected.id, reservationDate: date, reservationTime: slot.time, partySize: Number(party), event }) });
      setStatus("Reserva creada correctamente."); setSelected(null); setSlot(null);
    } catch (error) { setStatus(error.message); }
  }
  return <Layout><section className="locations-heading"><p className="eyebrow">Área metropolitana de Bucaramanga</p><h1>Encuentra tu sede favorita.</h1><p className="intro-copy">Filtra por ubicación o tipo de cocina y elige dónde vivir tu próxima experiencia.</p></section><section className="panel search-panel"><h2>Buscar sedes</h2><form className="locations-search-form" onSubmit={search}><div><label>Ubicación</label><select value={filters.city} onChange={(e) => setFilters({ ...filters, city: e.target.value })}><option value="">Todas las ubicaciones</option>{CITIES.map((city) => <option key={city}>{city}</option>)}</select></div><div><label>Tipo de cocina</label><input value={filters.cuisine} onChange={(e) => setFilters({ ...filters, cuisine: e.target.value })} placeholder="Ej. Santandereana" /></div><button className="button">Buscar</button></form><Status message={status} tone={status.includes("correctamente") ? "success" : "error"} /></section><section><div className="results-heading"><h2>Sedes disponibles</h2><span>{branches.length} sedes encontradas</span></div><div className="location-results">{branches.map((branch) => <article className="location-card" key={branch.id}><div><p className="location-card-kicker">{branch.cuisineType}</p><h3>{branch.restaurantName}</h3><p className="location-address">{branch.name} · {branch.address}, {branch.city}</p><p className="location-capacity">Capacidad: {branch.capacity} personas</p></div><button className="button button-small" onClick={() => choose(branch)}>Seleccionar sede</button></article>)}</div></section>{selected && <section className="panel reservation-panel"><p className="eyebrow">Reserva en tres pasos</p><h2>Elige fecha y horario</h2><p className="booking-copy">{selected.restaurantName} · {selected.name}</p><form className="availability-form" onSubmit={(e) => { e.preventDefault(); choose(selected); }}><div><label>Fecha</label><input type="date" min={todayIso()} value={date} onChange={(e) => setDate(e.target.value)} required /></div><button className="button">Consultar horarios</button></form><div className="slot-list">{slots.map((item) => <button className="slot-button" type="button" key={item.time} onClick={() => setSlot(item)} aria-pressed={slot?.time === item.time}><strong>{String(item.time).slice(0, 5)}</strong><small>{item.available} cupos disponibles</small></button>)}</div>{slot && <form className="reservation-confirm" onSubmit={reserve}><h3>Confirma tu reserva</h3><p className="booking-copy">{date} a las {String(slot.time).slice(0, 5)}</p><label>Evento de la reserva</label><select value={event} onChange={(e) => setEvent(e.target.value)}>{Object.entries(EVENTS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select><label>Número de personas</label><input type="number" min="1" max={slot.available} value={party} onChange={(e) => setParty(e.target.value)} required /><button className="button">Confirmar reserva</button></form>}</section>}</Layout>;
}
