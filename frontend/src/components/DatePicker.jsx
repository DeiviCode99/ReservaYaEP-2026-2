import { useMemo } from "react";
import clsx from "clsx";
import { CalendarDays } from "lucide-react";
import { todayIso } from "../lib/api";
import { parseIso, toIso } from "../lib/format";

const QUICK_DAYS = 10;

/* Selector de fecha: los próximos días como fichas (lo más común es reservar
   esta semana) y el calendario nativo para cualquier otra fecha. */
export function DatePicker({ value, onChange, labelledBy }) {
  const today = todayIso();
  const days = useMemo(() => Array.from({ length: QUICK_DAYS }, (_, offset) => {
    const date = parseIso(today);
    date.setDate(date.getDate() + offset);
    return {
      iso: toIso(date),
      weekday: offset === 0 ? "Hoy" : offset === 1 ? "Mañana" : date.toLocaleDateString("es-CO", { weekday: "short" }).replace(".", ""),
      day: date.getDate(),
      month: date.toLocaleDateString("es-CO", { month: "short" }).replace(".", ""),
      full: date.toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long" }),
    };
  }), [today]);
  const inQuickRange = days.some((day) => day.iso === value);

  return (
    <div>
      <div role="radiogroup" aria-labelledby={labelledBy} className="-mx-1 flex snap-x gap-2 overflow-x-auto px-1 pb-2 pt-1">
        {days.map((day) => {
          const selected = day.iso === value;
          return (
            <button
              key={day.iso}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={day.full}
              onClick={() => onChange(day.iso)}
              className={clsx(
                "flex h-[4.5rem] w-16 shrink-0 snap-start flex-col items-center justify-center rounded-2xl border-[1.5px] transition duration-150 active:scale-95",
                selected
                  ? "border-mostaza-600 bg-mostaza-500 text-tinta shadow-[0_2px_0_0_var(--color-mostaza-700)]"
                  : "border-piedra-300 bg-white text-tinta hover:border-mostaza-600 hover:bg-mostaza-50",
              )}
            >
              <span className={clsx("text-[0.7rem] font-semibold capitalize", selected ? "text-tinta" : "text-piedra-600")}>{day.weekday}</span>
              <span className="text-xl font-extrabold leading-tight tabular-nums">{day.day}</span>
              <span className={clsx("text-[0.7rem] capitalize", selected ? "text-tinta" : "text-piedra-600")}>{day.month}</span>
            </button>
          );
        })}
      </div>
      <label className={clsx(
        "mt-1 flex h-11 items-center gap-2 rounded-xl border-[1.5px] bg-white px-3 text-sm transition-colors focus-within:border-naranja-600 focus-within:ring-3 focus-within:ring-naranja-500/30",
        inQuickRange ? "border-piedra-300" : "border-mostaza-600 bg-mostaza-50",
      )}>
        <CalendarDays size={18} className="shrink-0 text-piedra-600" aria-hidden="true" />
        <span className="shrink-0 font-semibold text-piedra-700">Otra fecha</span>
        <input
          type="date"
          min={today}
          value={value}
          onChange={(event) => { if (event.target.value) onChange(event.target.value); }}
          className="min-w-0 flex-1 bg-transparent text-right font-semibold text-tinta outline-none"
        />
      </label>
    </div>
  );
}
