import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { AuthCard, AuthLayout } from "../layouts/AuthLayout";
import { Button } from "../components/ui/Button";
import { Field, Input, PasswordInput } from "../components/ui/Input";
import { GoogleLogin } from "../components/GoogleLogin";
import { EMAIL_RE } from "../lib/format";
import { authPost, FormMessage, linkClass, nextSuffix, RedirectIfLoggedIn, useSessionRedirect } from "./auth-shared";

function LoginForm() {
  const enter = useSessionRedirect();
  const [params] = useSearchParams();
  const [form, setForm] = useState({ email: "", password: "" });
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const update = (key) => (event) => {
    setForm((current) => ({ ...current, [key]: event.target.value }));
    setErrors((current) => ({ ...current, [key]: "" }));
  };

  async function submit(event) {
    event.preventDefault();
    const email = form.email.trim();
    const found = {
      email: EMAIL_RE.test(email) ? "" : "Introduce un correo electrónico válido.",
      password: form.password ? "" : "Escribe tu contraseña.",
    };
    setErrors(found);
    setMessage("");
    if (found.email || found.password) return;
    setLoading(true);
    try {
      enter(await authPost("/api/auth/login", { email, password: form.password }, "No se pudo iniciar sesión."));
    } catch (error) {
      setMessage(error.status === 401 ? "Correo o contraseña incorrectos." : error.message);
      setLoading(false);
    }
  }

  return (
    <AuthLayout
      title="Otra vez a la mesa."
      lead="Entra para ver tus reservas, cambiar la hora o administrar las sedes de tu restaurante."
      switcher={<>¿Primera vez aquí? <Link className={linkClass} to={`/registro${nextSuffix(params)}`}>Crea tu cuenta</Link></>}
    >
      <AuthCard title="Iniciar sesión" lead="Entra con el correo con el que te registraste.">
        <form onSubmit={submit} noValidate className="space-y-4">
          <Field label="Correo electrónico" error={errors.email}>
            <Input type="email" autoComplete="email" inputMode="email" value={form.email} onChange={update("email")} placeholder="tucorreo@ejemplo.com" />
          </Field>
          <Field label="Contraseña" error={errors.password}>
            <PasswordInput autoComplete="current-password" value={form.password} onChange={update("password")} />
          </Field>
          <p className="text-right text-sm">
            <Link className={linkClass} to="/recuperar">¿Olvidaste tu contraseña?</Link>
          </p>
          <FormMessage>{message}</FormMessage>
          <Button type="submit" size="lg" className="w-full" loading={loading}>Iniciar sesión</Button>
        </form>
        <GoogleLogin role="CLIENT" onStart={() => setMessage("")} onSession={enter} onError={setMessage} />
      </AuthCard>
    </AuthLayout>
  );
}

export default function Login() {
  return <RedirectIfLoggedIn><LoginForm /></RedirectIfLoggedIn>;
}
