import { forwardRef } from "react";
import clsx from "clsx";
import { ChevronDown } from "lucide-react";
import { CONTROL } from "./Input";

export const Select = forwardRef(function Select({ className, children, ...props }, ref) {
  return (
    <span className="relative block">
      <select ref={ref} className={clsx(CONTROL, "h-11 appearance-none pr-10", className)} {...props}>
        {children}
      </select>
      <ChevronDown size={18} className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-piedra-600" aria-hidden="true" />
    </span>
  );
});

/* Chip de filtro o de opción. Seleccionado = mostaza con texto tinta. */
export function Chip({ selected = false, className, children, ...props }) {
  return (
    <button
      type="button"
      className={clsx(
        "inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full border-[1.5px] px-4 text-sm font-semibold transition duration-150 active:scale-95",
        selected
          ? "border-mostaza-600 bg-mostaza-500 text-tinta shadow-[0_2px_0_0_var(--color-mostaza-700)]"
          : "border-piedra-300 bg-papel text-piedra-700 hover:border-mostaza-600 hover:bg-mostaza-50 hover:text-tinta",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
