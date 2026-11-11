import { useCallback, useEffect, useRef } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { IconButton } from "./ui/Button";

/* Visor de fotos a pantalla completa. Teclado: ← → para moverse, Esc cierra.
   `index` es la foto abierta o null si está cerrado. */
export function Lightbox({ photos, index, onChange, onClose, label = "Galería de fotos" }) {
  const ref = useRef(null);
  const open = index !== null && index !== undefined;

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const move = useCallback((step) => {
    onChange((index + step + photos.length) % photos.length);
  }, [index, onChange, photos.length]);

  function onKeyDown(event) {
    if (event.key === "ArrowRight") { event.preventDefault(); move(1); }
    if (event.key === "ArrowLeft") { event.preventDefault(); move(-1); }
  }

  const photo = open ? photos[index] : null;

  return (
    <dialog
      ref={ref}
      aria-label={label}
      onClose={onClose}
      onKeyDown={onKeyDown}
      className="foco-claro m-0 h-dvh max-h-none w-screen max-w-none bg-tinta p-0 text-white"
    >
      {photo && (
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between gap-3 px-3 py-2 sm:px-5">
            <p className="text-sm font-semibold tabular-nums" aria-live="polite">
              Foto {index + 1} de {photos.length}
            </p>
            <IconButton icon={X} label="Cerrar la galería" tone="dark" onClick={onClose} autoFocus />
          </div>
          <div
            className="relative flex min-h-0 flex-1 items-center justify-center px-2 sm:px-16"
            onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}
          >
            <img
              key={photo.src}
              src={photo.src}
              alt={photo.alt}
              className="max-h-full max-w-full animate-surgir rounded-xl object-contain"
            />
            {photos.length > 1 && (
              <>
                <IconButton icon={ChevronLeft} label="Foto anterior" tone="dark" size={26}
                  className="absolute left-1 top-1/2 -translate-y-1/2 bg-tinta/60 sm:left-3" onClick={() => move(-1)} />
                <IconButton icon={ChevronRight} label="Foto siguiente" tone="dark" size={26}
                  className="absolute right-1 top-1/2 -translate-y-1/2 bg-tinta/60 sm:right-3" onClick={() => move(1)} />
              </>
            )}
          </div>
          <p className="px-4 py-3 text-center text-sm text-white/80">{photo.alt}</p>
        </div>
      )}
    </dialog>
  );
}
