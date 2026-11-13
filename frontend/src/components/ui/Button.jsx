import clsx from "clsx";
import { LoaderCircle } from "lucide-react";
import { Link } from "react-router-dom";

/* Botón "de tecla": descansa sobre un canto sólido que se hunde al presionar. */
const BASE = "relative inline-flex shrink-0 items-center justify-center gap-2 rounded-full font-semibold whitespace-nowrap select-none "
  + "transition-[transform,box-shadow,background-color,color] duration-150 ease-out "
  + "hover:-translate-y-px active:translate-y-0.5 "
  + "disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50";

const VARIANTS = {
  primary: "bg-naranja-500 text-tinta shadow-[0_3px_0_0_var(--color-naranja-700)] hover:bg-naranja-400 hover:shadow-[0_4px_0_0_var(--color-naranja-700)] active:shadow-[0_0_0_0_var(--color-naranja-700)]",
  secondary: "bg-papel text-rojo-700 shadow-[inset_0_0_0_1.5px_var(--color-rojo-600),0_3px_0_0_var(--color-rojo-100)] hover:bg-rojo-50 active:shadow-[inset_0_0_0_1.5px_var(--color-rojo-600)]",
  ghost: "text-tinta hover:bg-tinta/8 hover:translate-y-0 active:translate-y-0 active:bg-tinta/12",
  danger: "bg-rojo-600 text-white shadow-[0_3px_0_0_var(--color-rojo-800)] hover:bg-rojo-500 hover:shadow-[0_4px_0_0_var(--color-rojo-800)] active:shadow-[0_0_0_0_var(--color-rojo-800)]",
  // Sobre fondos oscuros (header rojo, fotos).
  inverse: "text-white shadow-[inset_0_0_0_1.5px_rgb(255_255_255/0.7)] hover:bg-white/12 active:bg-white/20",
};

const SIZES = {
  sm: "h-9 px-4 text-sm",
  md: "h-11 px-5 text-[0.95rem]",
  lg: "h-13 px-7 text-base",
};

export function Button({
  variant = "primary", size = "md", loading = false, disabled = false, icon: Icon, iconRight: IconRight,
  to, className, children, type = "button", ...props
}) {
  const classes = clsx(BASE, VARIANTS[variant], SIZES[size], className);
  const iconSize = size === "sm" ? 16 : 18;
  const content = (
    <>
      {loading
        ? <LoaderCircle size={iconSize} className="animate-spin" aria-hidden="true" />
        : Icon && <Icon size={iconSize} aria-hidden="true" />}
      {children}
      {IconRight && !loading && <IconRight size={iconSize} aria-hidden="true" />}
    </>
  );
  if (to) return <Link to={to} className={classes} {...props}>{content}</Link>;
  return (
    <button type={type} className={classes} disabled={disabled || loading} aria-busy={loading || undefined} {...props}>
      {content}
    </button>
  );
}

/* Botón redondo solo con icono; `label` es obligatorio para lectores de pantalla. */
export function IconButton({ icon: Icon, label, className, size = 20, tone = "light", ...props }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={clsx(
        "inline-grid size-11 shrink-0 place-items-center rounded-full transition duration-150 active:scale-90 disabled:pointer-events-none disabled:opacity-40",
        tone === "light" && "text-tinta hover:bg-tinta/8",
        tone === "dark" && "foco-claro text-white hover:bg-white/15",
        tone === "solid" && "bg-papel text-tinta shadow-card hover:bg-mostaza-100",
        className,
      )}
      {...props}
    >
      <Icon size={size} aria-hidden="true" />
    </button>
  );
}
