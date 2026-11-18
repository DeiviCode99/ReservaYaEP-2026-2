import { useCallback, useEffect, useState } from "react";
import clsx from "clsx";
import { MapPin, Pencil, Plus, Store, Users } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { Field, Input, Textarea } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";
import { Badge } from "../../components/ui/Badge";
import { Card } from "../../components/ui/Card";
import { Modal } from "../../components/ui/Modal";
import { Loading, Skeleton } from "../../components/ui/Skeleton";
import { EmptyState } from "../../components/ui/EmptyState";
import { useToast } from "../../components/ui/Toast";
import { FormMessage } from "../auth-shared";
import { apiFetch } from "../../lib/api";
import { CITIES, DAYS, hhmm } from "../../lib/format";

const defaultSchedules = () => DAYS.map((_, index) => ({ dayOfWeek: index + 1, openTime: "12:00", closeTime: "22:00", isClosed: false }));

/* Completa los 7 días con lo que tenga la sede (el backend puede traer menos). */
function schedulesOf(branch) {
  const byDay = new Map((branch?.schedules || []).map((schedule) => [schedule.dayOfWeek, schedule]));
  return defaultSchedules().map((fallback) => {
    const saved = byDay.get(fallback.dayOfWeek);
    return saved
      ? { dayOfWeek: saved.dayOfWeek, openTime: hhmm(saved.openTime) || "12:00", closeTime: hhmm(saved.closeTime) || "22:00", isClosed: Boolean(saved.isClosed) }
      : fallback;
  });
}

function RestaurantForm({ restaurant, onSaved, onClose }) {
  const toast = useToast();
  const [form, setForm] = useState({
    name: restaurant?.name || "", cuisineType: restaurant?.cuisineType || "", description: restaurant?.description || "",
  });
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const update = (key) => (event) => { setForm({ ...form, [key]: event.target.value }); setErrors({ ...errors, [key]: "" }); };

  async function submit(event) {
    event.preventDefault();
    const found = {
      name: form.name.trim().length >= 2 ? "" : "El nombre es obligatorio (mínimo 2 caracteres).",
      cuisineType: form.cuisineType.trim().length >= 2 ? "" : "El tipo de cocina es obligatorio (mínimo 2 caracteres).",
    };
    setErrors(found);
    setMessage("");
    if (found.name || found.cuisineType) return;
    setSaving(true);
    try {
      await apiFetch(restaurant ? `/api/restaurants/${restaurant.id}` : "/api/restaurants", {
        method: restaurant ? "PUT" : "POST",
        body: JSON.stringify({ name: form.name.trim(), cuisineType: form.cuisineType.trim(), description: form.description.trim() || null }),
      });
      toast(restaurant ? "Restaurante actualizado." : "Restaurante registrado.", "success");
      onSaved();
    } catch (error) {
      setMessage(error.message);
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <Field label="Nombre del restaurante" error={errors.name}>
        <Input value={form.name} onChange={update("name")} maxLength={80} placeholder="Ej. Doña Marta" />
      </Field>
      <Field label="Tipo de cocina" error={errors.cuisineType}>
        <Input value={form.cuisineType} onChange={update("cuisineType")} maxLength={60} placeholder="Ej. Santandereana" />
      </Field>
      <Field label="Descripción" optional hint="Aparece en los resultados de búsqueda.">
        <Textarea value={form.description} onChange={update("description")} maxLength={500} />
      </Field>
      <FormMessage>{message}</FormMessage>
      <div className="flex flex-col-reverse gap-2.5 pt-1 sm:flex-row sm:justify-end">
        <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        <Button type="submit" loading={saving}>{restaurant ? "Actualizar restaurante" : "Guardar restaurante"}</Button>
      </div>
    </form>
  );
}

function BranchForm({ restaurant, branch, onSaved, onClose }) {
  const toast = useToast();
  const [form, setForm] = useState({
    name: branch?.name || "", address: branch?.address || "", city: branch?.city || "", phone: branch?.phone || "",
    capacity: branch?.capacity ?? 50, active: branch ? branch.active !== false : true,
  });
  const [schedules, setSchedules] = useState(() => schedulesOf(branch));
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const update = (key) => (event) => { setForm({ ...form, [key]: event.target.value }); setErrors({ ...errors, [key]: "" }); };
  const updateDay = (index, changes) => {
    setSchedules(schedules.map((schedule, position) => (position === index ? { ...schedule, ...changes } : schedule)));
    setErrors({ ...errors, schedules: "" });
  };

  async function submit(event) {
    event.preventDefault();
    const capacity = Number(form.capacity);
    const found = {
      name: form.name.trim() ? "" : "Escribe el nombre de la sede.",
      address: form.address.trim().length >= 5 ? "" : "Escribe la dirección completa (mínimo 5 caracteres).",
      city: CITIES.includes(form.city) ? "" : "Elige la ciudad.",
      capacity: Number.isInteger(capacity) && capacity >= 1 && capacity <= 500 ? "" : "La capacidad debe ser un número entre 1 y 500.",
      schedules: schedules.every((schedule) => schedule.isClosed) ? "Debe haber al menos un día abierto."
        : schedules.some((schedule) => !schedule.isClosed && (!schedule.openTime || !schedule.closeTime || schedule.openTime >= schedule.closeTime))
          ? "Revisa los horarios: la apertura debe ser antes del cierre." : "",
    };
    setErrors(found);
    setMessage("");
    if (Object.values(found).some(Boolean)) return;
    setSaving(true);
    try {
      const base = `/api/restaurants/${restaurant.id}/branches`;
      await apiFetch(branch ? `${base}/${branch.id}` : base, {
        method: branch ? "PUT" : "POST",
        body: JSON.stringify({
          name: form.name.trim(), address: form.address.trim(), city: form.city, phone: form.phone.trim() || null,
          // El formulario no edita coordenadas: se reenvían para no borrarlas.
          latitude: branch?.latitude ?? null, longitude: branch?.longitude ?? null,
          capacity, active: form.active, schedules,
        }),
      });
      toast(branch ? "Sede actualizada." : "Sede registrada.", "success");
      onSaved();
    } catch (error) {
      setMessage(error.message);
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nombre de la sede" error={errors.name}>
          <Input value={form.name} onChange={update("name")} maxLength={80} placeholder="Ej. Sede Cabecera" />
        </Field>
        <Field label="Ciudad" error={errors.city}>
          <Select value={form.city} onChange={update("city")}>
            <option value="">Elige la ciudad</option>
            {CITIES.map((city) => <option key={city}>{city}</option>)}
          </Select>
        </Field>
        <Field label="Dirección" error={errors.address} className="sm:col-span-2">
          <Input value={form.address} onChange={update("address")} maxLength={150} placeholder="Ej. Cra 33 #45-10" />
        </Field>
        <Field label="Teléfono" optional hint="Sirve para que el cliente confirme por llamada.">
          <Input type="tel" value={form.phone} onChange={update("phone")} maxLength={30} />
        </Field>
        <Field label="Capacidad por franja horaria" error={errors.capacity} hint="Personas que puedes atender a la misma hora.">
          <Input type="number" min="1" max="500" inputMode="numeric" value={form.capacity} onChange={update("capacity")} />
        </Field>
      </div>

      <label className="flex cursor-pointer items-start gap-3 rounded-2xl border-[1.5px] border-piedra-300 bg-white p-3.5 has-checked:border-exito-500 has-checked:bg-exito-50">
        <input type="checkbox" checked={form.active} onChange={(event) => setForm({ ...form, active: event.target.checked })} className="mt-0.5 size-5 accent-exito-600" />
        <span className="text-sm">
          <strong className="block font-bold text-tinta">Sede activa</strong>
          <span className="text-piedra-700">Los clientes pueden encontrarla y reservar.</span>
        </span>
      </label>

      <fieldset>
        <legend className="text-sm font-semibold text-tinta">Horarios de atención</legend>
        <p className="mt-1 text-sm text-piedra-600">Marca el día como cerrado si esa sede no atiende.</p>
        <ul className="mt-3 divide-y divide-tinta/8 rounded-2xl border border-tinta/10 bg-white">
          {schedules.map((schedule, index) => (
            <li key={schedule.dayOfWeek} className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-2 px-3.5 py-2.5 sm:grid-cols-[7rem_auto_1fr]">
              <span className="text-sm font-bold text-tinta">{DAYS[index]}</span>
              <label className="flex cursor-pointer items-center gap-2 text-sm text-piedra-800">
                <input type="checkbox" checked={schedule.isClosed} onChange={(event) => updateDay(index, { isClosed: event.target.checked })} className="size-4.5 accent-rojo-600" />
                Cerrado
              </label>
              <div className={clsx("col-span-2 flex items-center gap-2 sm:col-span-1 sm:justify-end", schedule.isClosed && "opacity-45")}>
                <Input type="time" aria-label={`${DAYS[index]}: hora de apertura`} disabled={schedule.isClosed} value={schedule.openTime}
                  onChange={(event) => updateDay(index, { openTime: event.target.value })} className="h-10 w-full sm:w-32" />
                <span className="text-sm text-piedra-600" aria-hidden="true">a</span>
                <Input type="time" aria-label={`${DAYS[index]}: hora de cierre`} disabled={schedule.isClosed} value={schedule.closeTime}
                  onChange={(event) => updateDay(index, { closeTime: event.target.value })} className="h-10 w-full sm:w-32" />
              </div>
            </li>
          ))}
        </ul>
        {errors.schedules && <div className="mt-3"><FormMessage>{errors.schedules}</FormMessage></div>}
      </fieldset>

      <FormMessage>{message}</FormMessage>
      <div className="flex flex-col-reverse gap-2.5 pt-1 sm:flex-row sm:justify-end">
        <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        <Button type="submit" loading={saving}>{branch ? "Guardar cambios" : "Guardar sede"}</Button>
      </div>
    </form>
  );
}

const openDays = (branch) => (branch.schedules || [])
  .filter((schedule) => !schedule.isClosed)
  .sort((a, b) => a.dayOfWeek - b.dayOfWeek)
  .map((schedule) => DAYS[schedule.dayOfWeek - 1])
  .join(", ") || "Sin días abiertos";

function BranchList({ restaurant, onChanged }) {
  const toast = useToast();
  const [state, setState] = useState({ status: "loading", items: [] });
  const [form, setForm] = useState(null); // null | { branch }

  const load = useCallback(async () => {
    try {
      const data = await apiFetch(`/api/restaurants/${restaurant.id}/branches`);
      setState({ status: "ready", items: Array.isArray(data) ? data : [] });
    } catch (error) {
      setState({ status: "ready", items: [] });
      toast(error.message, "error");
    }
  }, [restaurant.id, toast]);
  useEffect(() => { load(); }, [load]);

  return (
    <div className="border-t border-tinta/8 bg-crema-50 p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <h4 className="text-sm font-bold text-piedra-700">Sedes de {restaurant.name}</h4>
        <Button size="sm" variant="secondary" icon={Plus} onClick={() => setForm({ branch: null })}>Nueva sede</Button>
      </div>
      {state.status === "loading" && (
        <Loading label="Cargando sedes…" className="mt-3 space-y-2.5">
          <Skeleton className="h-20 rounded-2xl" /><Skeleton className="h-20 rounded-2xl" />
        </Loading>
      )}
      {state.status === "ready" && state.items.length === 0 && (
        <EmptyState art="restaurantes" className="mt-3 bg-papel py-7">Este restaurante todavía no tiene sedes.</EmptyState>
      )}
      {state.items.length > 0 && (
        <ul className="mt-3 grid gap-3 lg:grid-cols-2">
          {state.items.map((branch) => (
            <li key={branch.id} className="rounded-2xl border border-tinta/8 bg-papel p-4">
              <div className="flex items-start justify-between gap-3">
                <h5 className="font-extrabold text-tinta">{branch.name}</h5>
                {branch.active === false ? <Badge tone="off">Inactiva</Badge> : <Badge tone="ok">Activa</Badge>}
              </div>
              <p className="mt-1.5 flex items-start gap-1.5 text-sm text-piedra-700">
                <MapPin size={15} className="mt-0.5 shrink-0 text-piedra-500" aria-hidden="true" /> {branch.address}, {branch.city}
              </p>
              <p className="mt-1 flex items-center gap-1.5 text-sm text-piedra-700">
                <Users size={15} className="shrink-0 text-piedra-500" aria-hidden="true" /> {branch.capacity} personas por franja
              </p>
              <p className="mt-1 text-sm text-piedra-700"><strong className="font-semibold text-tinta">Atiende:</strong> {openDays(branch)}</p>
              <Button size="sm" variant="ghost" icon={Pencil} className="-ml-2 mt-2" onClick={() => setForm({ branch })} aria-label={`Editar la sede ${branch.name}`}>
                Editar
              </Button>
            </li>
          ))}
        </ul>
      )}

      <Modal
        open={Boolean(form)}
        onClose={() => setForm(null)}
        size="lg"
        title={form?.branch ? "Editar sede" : "Nueva sede"}
        description={`Sedes de: ${restaurant.name}`}
      >
        {form && (
          <BranchForm
            key={form.branch?.id || "nueva"}
            restaurant={restaurant}
            branch={form.branch}
            onClose={() => setForm(null)}
            onSaved={() => { setForm(null); load(); onChanged(); }}
          />
        )}
      </Modal>
    </div>
  );
}

/* HU-08: registro y configuración de restaurantes, sedes, horarios y aforo. */
export function RestaurantsTab({ onBranchesChanged }) {
  const toast = useToast();
  const [state, setState] = useState({ status: "loading", items: [] });
  const [form, setForm] = useState(null); // null | { restaurant }
  const [expanded, setExpanded] = useState(null);

  const load = useCallback(async () => {
    try {
      const data = await apiFetch("/api/restaurants?mine=true");
      if (!Array.isArray(data)) throw new Error("El servidor devolvió un formato de restaurantes inválido.");
      setState({ status: "ready", items: data });
      setExpanded((current) => current ?? (data.length === 1 ? data[0].id : null));
    } catch (error) {
      setState({ status: "ready", items: [] });
      toast(error.message, "error");
    }
  }, [toast]);
  useEffect(() => { load(); }, [load]);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-extrabold text-tinta">Mis restaurantes</h2>
          <p className="text-sm text-piedra-700">La marca que verán tus clientes, con sus sedes, horarios y aforo.</p>
        </div>
        <Button icon={Plus} onClick={() => setForm({ restaurant: null })}>Nuevo restaurante</Button>
      </div>

      {state.status === "loading" && (
        <Loading label="Cargando restaurantes…" className="mt-5 space-y-3">
          <Skeleton className="h-24 rounded-3xl" /><Skeleton className="h-24 rounded-3xl" />
        </Loading>
      )}
      {state.status === "ready" && state.items.length === 0 && (
        <EmptyState art="restaurantes" className="mt-5" title="Aún no has registrado ningún restaurante"
          action={<Button icon={Plus} onClick={() => setForm({ restaurant: null })}>Registrar mi restaurante</Button>}>
          Empieza por la marca; después podrás agregar sus sedes.
        </EmptyState>
      )}
      <ul className="mt-5 space-y-4">
        {state.items.map((restaurant) => {
          const open = expanded === restaurant.id;
          return (
            <Card as="li" key={restaurant.id} className="overflow-hidden">
              <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:p-5">
                <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-rojo-600 text-white">
                  <Store size={22} aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="text-lg font-extrabold text-tinta">{restaurant.name}</h3>
                  <p className="text-sm font-semibold text-rojo-700">Cocina {restaurant.cuisineType}</p>
                  {restaurant.description && <p className="mt-1 text-sm text-piedra-700">{restaurant.description}</p>}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="ghost" icon={Pencil} onClick={() => setForm({ restaurant })} aria-label={`Editar ${restaurant.name}`}>Editar</Button>
                  <Button size="sm" variant="secondary" aria-expanded={open} onClick={() => setExpanded(open ? null : restaurant.id)}>
                    {open ? "Ocultar sedes" : "Gestionar sedes"}
                  </Button>
                </div>
              </div>
              {open && <BranchList restaurant={restaurant} onChanged={onBranchesChanged} />}
            </Card>
          );
        })}
      </ul>

      <Modal open={Boolean(form)} onClose={() => setForm(null)} title={form?.restaurant ? "Editar restaurante" : "Nuevo restaurante"} description="La marca que verán tus clientes.">
        {form && (
          <RestaurantForm
            key={form.restaurant?.id || "nuevo"}
            restaurant={form.restaurant}
            onClose={() => setForm(null)}
            onSaved={() => { setForm(null); load(); onBranchesChanged(); }}
          />
        )}
      </Modal>
    </div>
  );
}
