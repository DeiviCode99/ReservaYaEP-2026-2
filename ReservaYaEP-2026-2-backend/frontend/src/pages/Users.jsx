import { useEffect, useState } from "react";
import { Page, SiteLayout } from "../layouts/SiteLayout";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { CONTROL, Field, Input, PasswordInput } from "../components/ui/Input";
import { Modal } from "../components/ui/Modal";
import { FormMessage } from "./auth-shared";
import { useToast } from "../components/ui/Toast";
import { userService } from "../lib/userService";

const EMPTY = { name: "", email: "", phone: "", role: "CLIENT", active: true, password: "" };

export default function Users() {
  const toast = useToast();
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState(null);
  const [error, setError] = useState("");

  async function load() {
    try {
      setUsers(await userService.list());
    } catch (failure) {
      toast(failure.message, "error");
    }
  }

  useEffect(() => { load(); }, []);

  function openCreate() {
    setError("");
    setForm({ ...EMPTY });
  }

  function openEdit(user) {
    setError("");
    setForm({ ...user, password: "" });
  }

  async function save(event) {
    event.preventDefault();
    setError("");
    try {
      if (form.id) {
        await userService.update(form.id, {
          name: form.name,
          email: form.email,
          phone: form.phone,
          role: form.role,
          active: form.active,
          password: form.password || undefined,
        });
        toast("Usuario actualizado.", "success");
      } else {
        await userService.create({
          name: form.name,
          email: form.email,
          phone: form.phone,
          role: form.role,
          password: form.password,
        });
        toast("Usuario creado.", "success");
      }
      setForm(null);
      await load();
    } catch (failure) {
      setError(failure.message);
    }
  }

  async function remove(user) {
    if (!window.confirm(`¿Eliminar a ${user.name}?`)) return;
    try {
      await userService.remove(user.id);
      toast("Usuario eliminado.", "success");
      await load();
    } catch (failure) {
      toast(failure.message, "error");
    }
  }

  return (
    <SiteLayout>
      <Page>
        <header className="flex items-center justify-between gap-4">
          <div>
            <p className="font-semibold text-piedra-700">Administración</p>
            <h1 className="mt-1 text-3xl font-extrabold text-rojo-700">Usuarios</h1>
          </div>
          <Button onClick={openCreate}>Nuevo usuario</Button>
        </header>
        <div className="mt-6 grid gap-3">
          {users.map((user) => (
            <Card key={user.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
              <div className="flex-1">
                <p className="font-bold">{user.name}</p>
                <p className="text-sm text-piedra-700">{user.email} · {user.role}</p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="secondary" onClick={() => openEdit(user)}>Editar</Button>
                <Button size="sm" variant="ghost" onClick={() => remove(user)}>Eliminar</Button>
              </div>
            </Card>
          ))}
        </div>
        {form && (
          <Modal open title={form.id ? "Editar usuario" : "Nuevo usuario"} onClose={() => setForm(null)}>
            <form onSubmit={save} className="space-y-4">
              <Field label="Nombre"><Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></Field>
              <Field label="Correo"><Input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></Field>
              <Field label="Teléfono"><Input value={form.phone || ""} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></Field>
              <Field label="Rol">
                <select className={`${CONTROL} h-11`} value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })}>
                  <option value="CLIENT">Cliente</option>
                  <option value="RESTAURANT_ADMIN">Administrador de restaurante</option>
                  <option value="SYSTEM_ADMIN">Administrador del sistema</option>
                </select>
              </Field>
              {form.id && (
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={form.active} onChange={(event) => setForm({ ...form, active: event.target.checked })} />
                  Cuenta activa
                </label>
              )}
              <Field label={form.id ? "Nueva contraseña (opcional)" : "Contraseña"}>
                <PasswordInput value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} />
              </Field>
              <FormMessage>{error}</FormMessage>
              <Button type="submit" className="w-full">Guardar</Button>
            </form>
          </Modal>
        )}
      </Page>
    </SiteLayout>
  );
}
