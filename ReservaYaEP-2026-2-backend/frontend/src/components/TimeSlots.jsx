import clsx from "clsx";
import { Minus, Plus } from "lucide-react";
import { Loading, Skeleton } from "./ui/Skeleton";
import { hhmm } from "../lib/format";

/* Franjas con cupo como fichas. `state`: { status: "idle" | "loading" | "ready" | "empty" | "error", items, message } */
export function TimeSlots({ state, value, onChange, labelledBy }) {
  if (state.status === "loading") {
    return (
      <Loading label="Consultando disponibilidad…" className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {Array.from({ length: 8 }, (_, index) => <Skeleton key={index} className="h-14 rounded-2xl" />)}
      </Loading>
    );
  }
  if (state.status === "empty" || state.status === "error") {
    return (
      <p role={state.status === "error" ? "alert" : "status"} className={clsx(
        "rounded-2xl px-4 py-3 text-sm font-medium",
        state.status === "error" ? "bg-rojo-50 text-rojo-800" : "bg-crema-100 text-piedra-800",
      )}>
        {state.message}
      </p>
    );
  }
  if (state.status !== "ready") return null;

  return (
    <div role="radiogroup" aria-labelledby={labelledBy} className="grid grid-cols-3 gap-2 sm:grid-cols-4">
      {state.items.map((slot) => {
        const selected = value?.time === slot.time;
        return (
          <button
            key={slot.time}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(slot)}
            className={clsx(
              "flex h-14 flex-col items-center justify-center rounded-2xl border-[1.5px] transition duration-150 active:scale-95",
              selected
                ? "border-mostaza-600 bg-mostaza-500 text-tinta shadow-[0_2px_0_0_var(--color-mostaza-700)]"
                : "border-piedra-300 bg-white text-tinta hover:border-mostaza-600 hover:bg-mostaza-50",
            )}
          >
            <strong className="text-base font-extrabold leading-tight tabular-nums">{hhmm(slot.time)}</strong>
            <small className={clsx("text-[0.7rem] tabular-nums", selected ? "text-tinta" : "text-piedra-600")}>
              {slot.available} {slot.available === 1 ? "cupo" : "cupos"}
            </small>
          </button>
        );
      })}
    </div>
  );
}

/* Contador de personas con botones − y +. */
export function Counter({ value, onChange, min = 1, max = 50, labelledBy, unit = ["persona", "personas"] }) {
  const set = (next) => onChange(Math.max(min, Math.min(max, next)));
  const stepButton = "grid size-11 place-items-center rounded-full border-[1.5px] border-piedra-300 bg-white text-tinta transition duration-150 "
    + "hover:border-mostaza-600 hover:bg-mostaza-50 active:scale-90 disabled:pointer-events-none disabled:opacity-40";
  return (
    <div role="group" aria-labelledby={labelledBy} className="flex items-center gap-3">
      <button type="button" className={stepButton} onClick={() => set(value - 1)} disabled={value <= min} aria-label="Una persona menos">
        <Minus size={18} aria-hidden="true" />
      </button>
      <output aria-live="polite" className="min-w-24 text-center">
        <span className="text-2xl font-extrabold tabular-nums">{value}</span>{" "}
        <span className="text-sm text-piedra-700">{value === 1 ? unit[0] : unit[1]}</span>
      </output>
      <button type="button" className={stepButton} onClick={() => set(value + 1)} disabled={value >= max} aria-label="Una persona más">
        <Plus size={18} aria-hidden="true" />
      </button>
    </div>
  );
}
