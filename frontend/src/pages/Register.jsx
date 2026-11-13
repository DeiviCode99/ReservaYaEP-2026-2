import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import clsx from "clsx";
import { Store, UtensilsCrossed } from "lucide-react";
import { AuthCard, AuthLayout } from "../layouts/AuthLayout";
import { Button } from "../components/ui/Button";
import { Field, Input, PasswordInput } from "../components/ui/Input";
import { GoogleLogin } from "../components/GoogleLogin";
import { EMAIL_RE } from "../lib/format";
import { authPost, FormMessage, linkClass, nextSuffix, RedirectIfLoggedIn, useSessionRedirect } from "./auth-shared";

const ROLES = [
  { value: "CLIENT", icon: UtensilsCrossed, title: "Quiero reservar", text: "Busca mesa y gestiona tus reservas." },
  { value: "RESTAURANT_ADMIN", icon: Store, title: "Tengo un restaurante", text: "Registra tus sedes, horarios y aforo." },
];

function validate(form) {
  return {
    name: form.name.trim().length >= 2 ? "" : "Escribe tu nombre (mínimo 2 caracteres).",
    email: EMAIL_RE.test(form.email.trim()) ? "" : "Introduce un correo electrónico válido.",
    password: form.password.length < 8 ? "La contraseña debe tener al menos 8 caracteres."
      : form.password.length > 72 ? "La contraseña admite máximo 72 caracteres." : "",
    confirm: form.confirm === form.password ? "" : "Las contraseñas no coinciden.",
  };
}

function RegisterForm() {
  const enter = useSessionRedirect();
  const [params] = useSearchParams();
  const [form, setForm] = useState({
    name: "", email: "", password: "", confirm: "",
    role: params.get("rol") === "restaurante" ? "RESTAURANT_ADMIN" : "CLIENT",
  });
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  function update(key, value) {
    const next = { ...form, [key]: value };
    setForm(next);
    // Tras el primer intento, los errores se corrigen mientras se escribe.
    if (touched) setErrors(validate(next));
  }

  async function submit(event) {
    event.preventDefault();
    const found = validate(form);
    setErrors(found);
    setTouched(true);
    setMessage("");
    if (Object.values(found).some(Boolean)) return;
    setLoading(true);
    try {
      enter(await authPost("/api/auth/register", {
        name: form.name.trim(), email: form.email.trim(), password: form.password, role: form.role,
      }, "No se pudo crear la cuenta."));
    } catch (error) {
      setMessage(error.message);
      setLoading(false);
    }
  }

  return (
    <AuthLayout
      title="Tu mesa te está esperando."
      lead="Reserva en los restaurantes de tu ciudad y llega directo a la mesa, sin llamadas ni filas en la puerta."
      switcher={<>¿Ya tienes cuenta? <Link className={linkClass} to={`/login${nextSuffix(params)}`}>Inicia sesión</Link></>}
    >
      <AuthCard title="Crear cuenta" lead="Toma menos de un minuto. Solo necesitas un correo y una contraseña.">
        <form onSubmit={submit} noValidate className="space-y-4">
          <fieldset>
            <legend className="mb-2 text-sm font-semibold text-tinta">¿Cómo vas a usar ReservaYa?</legend>
            <div className="grid grid-cols-2 gap-3">
              {ROLES.map((role) => {
                const selected = form.role === role.value;
                return (
                  <label
                    key={role.value}
                    className={clsx(
                      "relative flex cursor-pointer flex-col rounded-2xl border-[1.5px] p-3.5 transition duration-150 has-focus-visible:outline-3 has-focus-visible:outline-offset-2 has-focus-visible:outline-naranja-600",
                      selected ? "border-mostaza-600 bg-mostaza-100 shadow-[0_2px_0_0_var(--color-mostaza-700)]" : "border-piedra-300 bg-white hover:border-mostaza-600",
                    )}
                  >
                    <input type="radio" name="role" value={role.value} checked={selected} onChange={() => update("role", role.value)} className="sr-only" />
                    <role.icon size={22} className={selected ? "text-rojo-700" : "text-piedra-600"} aria-hidden="true" />
                    <span className="mt-2 text-sm font-bold text-tinta">{role.title}</span>
                    <span className="mt-0.5 text-xs text-piedra-700">{role.text}</span>
                  </label>
                );
              })}
            </div>
          </fieldset>
          <Field label="Nombre" error={errors.name}>
            <Input autoComplete="name" value={form.name} onChange={(event) => update("name", event.target.value)} maxLength={80} />
          </Field>
          <Field label="Correo electrónico" error={errors.email}>
            <Input type="email" autoComplete="email" inputMode="email" value={form.email} onChange={(event) => update("email", event.target.value)} placeholder="tucorreo@ejemplo.com" />
          </Field>
          <Field label="Contraseña" hint="Mínimo 8 caracteres." error={errors.password}>
            <PasswordInput autoComplete="new-password" value={form.password} onChange={(event) => update("password", event.target.value)} maxLength={72} />
          </Field>
          <Field label="Repite la contraseña" error={errors.confirm}>
            <PasswordInput autoComplete="new-password" value={form.confirm} onChange={(event) => update("confirm", event.target.value)} maxLength={72} />
          </Field>
          <FormMessage>{message}</FormMessage>
          <Button type="submit" size="lg" className="w-full" loading={loading}>Crear cuenta</Button>
        </form>
        <GoogleLogin role={form.role} onStart={() => setMessage("")} onSession={enter} onError={setMessage} />
      </AuthCard>
    </AuthLayout>
  );
}

export default function Register() {
  return <RedirectIfLoggedIn><RegisterForm /></RedirectIfLoggedIn>;
}
