import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { CircleAlert, CircleCheck, Info, X } from "lucide-react";

const ToastContext = createContext(() => {});

const TONES = {
  success: { icon: CircleCheck, bar: "bg-exito-500", iconColor: "text-exito-600" },
  error: { icon: CircleAlert, bar: "bg-rojo-600", iconColor: "text-rojo-600" },
  info: { icon: Info, bar: "bg-mostaza-500", iconColor: "text-mostaza-700" },
};

/* Avisos breves en lugar de alert(). Uso: const toast = useToast(); toast("Listo", "success"). */
export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const sequence = useRef(0);

  const dismiss = useCallback((id) => setItems((current) => current.filter((item) => item.id !== id)), []);
  const toast = useCallback((message, tone = "info") => {
    if (!message) return;
    sequence.current += 1;
    const id = sequence.current;
    setItems((current) => [...current.slice(-2), { id, message, tone: TONES[tone] ? tone : "info" }]);
    window.setTimeout(() => dismiss(id), tone === "error" ? 8000 : 5500);
  }, [dismiss]);

  const value = useMemo(() => toast, [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex flex-col items-center gap-2.5 p-4 sm:items-end sm:p-6" aria-live="polite" aria-relevant="additions">
        {items.map((item) => {
          const { icon: Icon, bar, iconColor } = TONES[item.tone];
          return (
            <div
              key={item.id}
              role={item.tone === "error" ? "alert" : "status"}
              className="pointer-events-auto relative flex w-full max-w-sm animate-aviso items-start gap-3 overflow-hidden rounded-2xl border border-tinta/10 bg-papel py-3.5 pl-5 pr-2 shadow-lift"
            >
              <span className={clsx("absolute inset-y-0 left-0 w-1.5", bar)} aria-hidden="true" />
              <Icon size={20} className={clsx("mt-0.5 shrink-0", iconColor)} aria-hidden="true" />
              <p className="min-w-0 flex-1 text-sm font-medium text-tinta">{item.message}</p>
              <button
                type="button"
                onClick={() => dismiss(item.id)}
                aria-label="Cerrar aviso"
                className="grid size-8 shrink-0 place-items-center rounded-full text-piedra-600 hover:bg-tinta/8 hover:text-tinta"
              >
                <X size={16} aria-hidden="true" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
