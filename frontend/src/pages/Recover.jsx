import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { AuthCard, AuthLayout } from "../layouts/AuthLayout";
import { Button } from "../components/ui/Button";
import { Field, Input, PasswordInput } from "../components/ui/Input";
import { EMAIL_RE } from "../lib/format";
import { authPost, FormMessage, linkClass, useSessionRedirect } from "./auth-shared";

function RequestLink() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [result, setResult] = useState({ tone: "", text: "" });
  const [loading, setLoading] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setResult({ tone: "", text: "" });
    if (!EMAIL_RE.test(email.trim())) return setError("Introduce un correo electrónico válido.");
    setLoading(true);
    try {
      const data = await authPost("/api/auth/forgot-password", { email: email.trim() }, "No se pudo enviar el enlace.");
      setResult({
        tone: "success",
        text: `${data.message || "Si el correo existe, recibirás instrucciones."} Revisa también la carpeta de spam.`,
      });
    } catch (failure) {
      setResult({ tone: "error", text: failure.message });
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthCard title="Recuperar cuenta" lead="Escribe el correo de tu cuenta y te enviaremos un enlace que vence en 30 minutos.">
      <form onSubmit={submit} noValidate className="space-y-4">
        <Field label="Correo electrónico" error={error}>
          <Input type="email" autoComplete="email" inputMode="email" value={email}
            onChange={(event) => { setEmail(event.target.value); setError(""); }} placeholder="tucorreo@ejemplo.com" />
        </Field>
        <FormMessage tone={result.tone}>{result.text}</FormMessage>
        <Button type="submit" size="lg" className="w-full" loading={loading}>Enviar enlace</Button>
      </form>
    </AuthCard>
  );
}

function ResetPassword({ token }) {
  const enter = useSessionRedirect();
  const [form, setForm] = useState({ password: "", confirm: "" });
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event) {
    event.preventDefault();
    const found = {
      password: form.password.length < 8 ? "La contraseña debe tener al menos 8 caracteres." : "",
      confirm: form.password !== form.confirm ? "Las contraseñas no coinciden." : "",
    };
    setErrors(found);
    setMessage("");
    if (found.password || found.confirm) return;
    setLoading(true);
    try {
      enter(await authPost("/api/auth/reset-password", { token, password: form.password }, "El enlace no es válido o ya venció."));
    } catch (failure) {
      setMessage(failure.message);
      setLoading(false);
    }
  }

  return (
    <AuthCard title="Nueva contraseña" lead="Elige una contraseña de al menos 8 caracteres. Al guardarla entrarás directo a tu cuenta.">
      <form onSubmit={submit} noValidate className="space-y-4">
        <Field label="Contraseña nueva" error={errors.password}>
          <PasswordInput autoComplete="new-password" maxLength={72} value={form.password}
            onChange={(event) => { setForm({ ...form, password: event.target.value }); setErrors({}); }} />
        </Field>
        <Field label="Repite la contraseña" error={errors.confirm}>
          <PasswordInput autoComplete="new-password" maxLength={72} value={form.confirm}
            onChange={(event) => { setForm({ ...form, confirm: event.target.value }); setErrors({}); }} />
        </Field>
        <FormMessage>{message}</FormMessage>
        <Button type="submit" size="lg" className="w-full" loading={loading}>Guardar y entrar</Button>
      </form>
    </AuthCard>
  );
}

export default function Recover() {
  const [params] = useSearchParams();
  const token = params.get("token");
  return (
    <AuthLayout
      title="Nadie se queda sin mesa."
      lead="Te enviamos un enlace a tu correo para que elijas una contraseña nueva. Tus reservas siguen donde las dejaste."
      switcher={<>¿Ya la recordaste? <Link className={linkClass} to="/login">Inicia sesión</Link></>}
    >
      {token ? <ResetPassword token={token} /> : <RequestLink />}
    </AuthLayout>
  );
}
