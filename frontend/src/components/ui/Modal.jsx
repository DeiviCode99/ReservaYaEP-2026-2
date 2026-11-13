import { useEffect, useId, useRef } from "react";
import clsx from "clsx";
import { X } from "lucide-react";
import { IconButton } from "./Button";

const SIZES = { sm: "sm:max-w-md", md: "sm:max-w-xl", lg: "sm:max-w-3xl" };

/* Diálogo modal sobre <dialog>: el navegador da la trampa de foco, Esc y el
   fondo inerte. En móvil sube como hoja inferior. */
export function Modal({ open, onClose, title, description, size = "md", footer, children }) {
  const ref = useRef(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(event) => { if (event.target === ref.current) onClose(); }}
      className={clsx(
        "mx-auto mb-0 mt-auto max-h-[92dvh] w-full max-w-none overflow-hidden rounded-t-3xl bg-papel p-0 text-tinta shadow-lift open:animate-aviso",
        "sm:my-auto sm:w-[calc(100%-2rem)] sm:rounded-3xl",
        SIZES[size],
      )}
    >
      {open && (
        <div className="flex max-h-[92dvh] flex-col">
          <header className="flex items-start gap-3 border-b border-tinta/8 px-5 py-4 sm:px-6">
            <div className="min-w-0 flex-1">
              <h2 id={titleId} className="text-xl font-extrabold text-rojo-700">{title}</h2>
              {description && <p className="mt-1 text-sm text-piedra-700">{description}</p>}
            </div>
            <IconButton icon={X} label="Cerrar" onClick={onClose} className="-mr-2 -mt-1.5" />
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">{children}</div>
          {footer && (
            <footer className="flex flex-col-reverse gap-2.5 border-t border-tinta/8 bg-crema-50 px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
              {footer}
            </footer>
          )}
        </div>
      )}
    </dialog>
  );
}
