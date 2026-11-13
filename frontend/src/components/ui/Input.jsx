import { cloneElement, forwardRef, useId, useState } from "react";
import clsx from "clsx";
import { CircleAlert, Eye, EyeOff } from "lucide-react";

export const CONTROL = "block w-full rounded-xl border-[1.5px] border-piedra-300 bg-white px-3.5 text-tinta placeholder:text-piedra-400 "
  + "transition-colors duration-150 hover:border-piedra-500 focus:border-naranja-600 focus:outline-none focus:ring-3 focus:ring-naranja-500/30 "
  + "disabled:cursor-not-allowed disabled:bg-piedra-100 disabled:text-piedra-500 "
  + "aria-invalid:border-rojo-600 aria-invalid:focus:ring-rojo-500/25";

/* Etiqueta + control + ayuda + error en línea. El hijo recibe id y aria-*. */
export function Field({ label, hint, error, optional = false, className, children }) {
  const id = useId();
  const describedBy = [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(" ") || undefined;
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 flex items-baseline justify-between gap-2 text-sm font-semibold text-tinta">
        {label}
        {optional && <span className="text-xs font-normal text-piedra-600">Opcional</span>}
      </label>
      {cloneElement(children, { id, "aria-describedby": describedBy, "aria-invalid": error ? true : undefined })}
      {hint && !error && <p id={`${id}-hint`} className="mt-1.5 text-sm text-piedra-600">{hint}</p>}
      {error && (
        <p id={`${id}-error`} className="mt-1.5 flex items-start gap-1.5 text-sm font-medium text-rojo-700">
          <CircleAlert size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}
    </div>
  );
}

export const Input = forwardRef(function Input({ className, icon: Icon, ...props }, ref) {
  if (!Icon) return <input ref={ref} className={clsx(CONTROL, "h-11", className)} {...props} />;
  return (
    <span className="relative block">
      <Icon size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-piedra-500" aria-hidden="true" />
      <input ref={ref} className={clsx(CONTROL, "h-11 pl-10", className)} {...props} />
    </span>
  );
});

export const Textarea = forwardRef(function Textarea({ className, rows = 3, ...props }, ref) {
  return <textarea ref={ref} rows={rows} className={clsx(CONTROL, "resize-y py-2.5", className)} {...props} />;
});

export const PasswordInput = forwardRef(function PasswordInput({ className, ...props }, ref) {
  const [visible, setVisible] = useState(false);
  return (
    <span className="relative block">
      <input ref={ref} type={visible ? "text" : "password"} className={clsx(CONTROL, "h-11 pr-12", className)} {...props} />
      <button
        type="button"
        onClick={() => setVisible((current) => !current)}
        aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
        aria-pressed={visible}
        className="absolute right-1 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-full text-piedra-600 hover:bg-tinta/8 hover:text-tinta"
      >
        {visible ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
      </button>
    </span>
  );
});
