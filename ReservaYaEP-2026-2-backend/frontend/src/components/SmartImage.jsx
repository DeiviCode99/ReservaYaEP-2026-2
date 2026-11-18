import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { UtensilsCrossed } from "lucide-react";

/* Imagen con proporción fija (la da `className`, p. ej. aspect-[4/3]),
   esqueleto mientras carga y respaldo si falla. */
export function SmartImage({ src, srcSet, sizes, alt, className, imgClassName, eager = false }) {
  const [state, setState] = useState("loading");
  const ref = useRef(null);

  useEffect(() => {
    setState("loading");
    const image = ref.current;
    // Si ya estaba en caché, onLoad pudo dispararse antes de montar.
    if (image?.complete) setState(image.naturalWidth ? "ok" : "error");
  }, [src]);

  return (
    <div className={clsx("relative overflow-hidden bg-crema-200", className)}>
      {state === "loading" && <span className="absolute inset-0 animate-pulse bg-tinta/10" aria-hidden="true" />}
      {state === "error" ? (
        <div role="img" aria-label={alt} className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-crema-200 text-piedra-600">
          <UtensilsCrossed size={28} aria-hidden="true" />
          <span className="text-xs font-semibold">Imagen no disponible</span>
        </div>
      ) : (
        <img
          ref={ref}
          src={src}
          srcSet={srcSet}
          sizes={sizes}
          alt={alt}
          loading={eager ? "eager" : "lazy"}
          // React 18 solo acepta el atributo en minúsculas.
          fetchpriority={eager ? "high" : undefined}
          decoding="async"
          onLoad={() => setState("ok")}
          onError={() => setState("error")}
          className={clsx(
            "absolute inset-0 size-full object-cover transition-opacity duration-500",
            state === "ok" ? "opacity-100" : "opacity-0",
            imgClassName,
          )}
        />
      )}
    </div>
  );
}
