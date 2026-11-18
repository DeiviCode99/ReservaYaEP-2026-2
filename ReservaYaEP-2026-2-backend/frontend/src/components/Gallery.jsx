import { useState } from "react";
import clsx from "clsx";
import { Images } from "lucide-react";
import { Lightbox } from "./Lightbox";
import { SmartImage } from "./SmartImage";

/* Mostrador de fotos de la sede: una grande y cuatro pequeñas en escritorio,
   una sola con contador en móvil. Cualquier foto abre el visor. */
export function Gallery({ photos, label }) {
  const [open, setOpen] = useState(null);
  if (!photos.length) return null;

  return (
    <div className="relative">
      <ul className="grid grid-cols-1 gap-2 md:aspect-[5/2] md:grid-cols-4 md:grid-rows-2">
        {photos.slice(0, 5).map((photo, index) => (
          <li
            key={photo.id}
            className={clsx(index === 0 ? "md:col-span-2 md:row-span-2" : "hidden md:block")}
          >
            <button
              type="button"
              onClick={() => setOpen(index)}
              aria-label={`Ampliar foto ${index + 1} de ${photos.length}: ${photo.alt}`}
              className={clsx(
                "group block size-full overflow-hidden",
                index === 0 && "rounded-3xl md:rounded-r-none",
                index === 2 && "md:rounded-tr-3xl",
                index === 4 && "md:rounded-br-3xl",
              )}
            >
              <SmartImage
                src={index === 0 ? photo.src : photo.thumb}
                srcSet={index === 0 ? photo.srcSet : undefined}
                sizes={index === 0 ? "(min-width: 768px) 50vw, 100vw" : undefined}
                alt=""
                eager={index === 0}
                className="aspect-[4/3] size-full md:aspect-auto"
                imgClassName="transition-transform duration-500 group-hover:scale-105"
              />
            </button>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={() => setOpen(0)}
        className="absolute bottom-3 left-3 inline-flex h-10 items-center gap-2 rounded-full bg-papel px-4 text-sm font-bold text-tinta shadow-lift transition hover:bg-mostaza-100 active:scale-95"
      >
        <Images size={16} aria-hidden="true" />
        Ver las {photos.length} fotos
      </button>
      <Lightbox photos={photos} index={open} onChange={setOpen} onClose={() => setOpen(null)} label={label} />
    </div>
  );
}
