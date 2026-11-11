import { Children, useCallback, useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import useEmblaCarousel from "embla-carousel-react";
import Autoplay from "embla-carousel-autoplay";
import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import { IconButton } from "./ui/Button";

const prefersReducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* Carrusel accesible (patrón APG): región con nombre, diapositivas agrupadas,
   flechas, puntos y, si hay autoplay, botón de pausa. Arrastre y swipe táctil.
   variant "rail": tarjetas con separación · variant "hero": diapositivas a sangre. */
export function Carousel({
  label, children, variant = "rail", autoplay = false, delay = 6000, loop = false,
  slideClassName = "basis-full", className, viewportClassName, header, overlay, controlsClassName = "bottom-0",
}) {
  const slides = Children.toArray(children);
  const reduced = useMemo(prefersReducedMotion, []);
  const plugins = useMemo(
    () => (autoplay && !reduced
      ? [Autoplay({ delay, stopOnInteraction: false, stopOnMouseEnter: true, stopOnFocusIn: true })]
      : []),
    [autoplay, delay, reduced],
  );
  const [viewportRef, api] = useEmblaCarousel(
    { loop, align: "start", slidesToScroll: variant === "rail" ? "auto" : 1, duration: reduced ? 0 : 25 },
    plugins,
  );
  const [state, setState] = useState({ index: 0, count: 0, prev: false, next: false });
  const [playing, setPlaying] = useState(autoplay && !reduced);

  useEffect(() => {
    if (!api) return undefined;
    const sync = () => setState({
      index: api.selectedScrollSnap(),
      count: api.scrollSnapList().length,
      prev: api.canScrollPrev(),
      next: api.canScrollNext(),
    });
    const onPlay = () => setPlaying(true);
    const onStop = () => setPlaying(false);
    sync();
    api.on("select", sync).on("reInit", sync).on("autoplay:play", onPlay).on("autoplay:stop", onStop);
    return () => { api.off("select", sync).off("reInit", sync).off("autoplay:play", onPlay).off("autoplay:stop", onStop); };
  }, [api]);

  const toggleAutoplay = useCallback(() => {
    const player = api?.plugins()?.autoplay;
    if (!player) return;
    if (player.isPlaying()) player.stop(); else player.play();
  }, [api]);

  const hero = variant === "hero";
  const showNav = state.count > 1;

  const dots = showNav && (
    <div className="flex items-center gap-1" role="group" aria-label="Elegir diapositiva">
      {Array.from({ length: state.count }, (_, index) => (
        <button
          key={index}
          type="button"
          onClick={() => api?.scrollTo(index)}
          aria-label={`Ir a la diapositiva ${index + 1} de ${state.count}`}
          aria-current={index === state.index ? "true" : undefined}
          className="group grid size-7 place-items-center"
        >
          <span className={clsx(
            "h-2 rounded-full transition-all duration-300",
            index === state.index
              ? "w-6 bg-mostaza-500"
              : clsx("w-2", hero ? "bg-white/60 group-hover:bg-white" : "bg-piedra-300 group-hover:bg-piedra-500"),
          )} />
        </button>
      ))}
    </div>
  );

  return (
    <section aria-roledescription="carrusel" aria-label={label} className={clsx(hero ? "foco-claro" : "relative", className)}>
      {!hero && (header || showNav) && (
        <div className="mb-5 flex items-end justify-between gap-4">
          <div className="min-w-0">{header}</div>
          {showNav && (
            <div className="hidden shrink-0 gap-2 sm:flex">
              <IconButton icon={ChevronLeft} label="Anterior" tone="solid" disabled={!state.prev} onClick={() => api?.scrollPrev()} />
              <IconButton icon={ChevronRight} label="Siguiente" tone="solid" disabled={!state.next} onClick={() => api?.scrollNext()} />
            </div>
          )}
        </div>
      )}

      <div ref={viewportRef} className={clsx("overflow-hidden", hero && "h-full", viewportClassName)}>
        <div className={clsx("flex touch-pan-y", hero ? "h-full" : "-ml-4 sm:-ml-5")} aria-live={playing ? "off" : "polite"}>
          {slides.map((slide, index) => (
            <div
              key={slide.key ?? index}
              role="group"
              aria-roledescription="diapositiva"
              aria-label={`${index + 1} de ${slides.length}`}
              className={clsx("min-w-0 shrink-0 grow-0", !hero && "pl-4 sm:pl-5", slideClassName)}
            >
              {slide}
            </div>
          ))}
        </div>
      </div>

      {overlay}

      {hero ? (
        showNav && (
          <div className={clsx("absolute inset-x-0 z-10 mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 pb-3 sm:px-6", controlsClassName)}>
            {dots}
            <div className="flex items-center">
              {autoplay && !reduced && (
                <IconButton
                  icon={playing ? Pause : Play}
                  label={playing ? "Pausar el carrusel" : "Reanudar el carrusel"}
                  tone="dark"
                  size={18}
                  onClick={toggleAutoplay}
                />
              )}
              <IconButton icon={ChevronLeft} label="Foto anterior" tone="dark" onClick={() => api?.scrollPrev()} />
              <IconButton icon={ChevronRight} label="Foto siguiente" tone="dark" onClick={() => api?.scrollNext()} />
            </div>
          </div>
        )
      ) : (
        showNav && <div className="mt-4 flex justify-center">{dots}</div>
      )}
    </section>
  );
}
