import { Children, useCallback, useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import useEmblaCarousel from "embla-carousel-react";
import Autoplay from "embla-carousel-autoplay";
import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import { IconButton } from "./ui/Button";

const prefersReducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function Dots({ count, index, onSelect, onDark = false }) {
  if (count < 2) return null;
  return (
    <div className="flex items-center gap-1" role="group" aria-label="Elegir diapositiva">
      {Array.from({ length: count }, (_, position) => (
        <button
          key={position}
          type="button"
          onClick={() => onSelect(position)}
          aria-label={`Ir a la diapositiva ${position + 1} de ${count}`}
          aria-current={position === index ? "true" : undefined}
          className="group grid size-7 place-items-center"
        >
          <span className={clsx(
            "h-2 rounded-full transition-all duration-300",
            position === index
              ? "w-6 bg-mostaza-500"
              : clsx("w-2", onDark ? "bg-white/60 group-hover:bg-white" : "bg-piedra-300 group-hover:bg-piedra-500"),
          )} />
        </button>
      ))}
    </div>
  );
}

/* Carrusel a sangre para el hero (patrón APG): región con nombre, diapositivas
   agrupadas, flechas, puntos y botón de pausa para el autoplay. Arrastre y swipe. */
export function Carousel({
  label, children, autoplay = false, delay = 6000, loop = false,
  className, overlay, controlsClassName = "bottom-0",
}) {
  const slides = Children.toArray(children);
  const reduced = useMemo(prefersReducedMotion, []);
  const plugins = useMemo(
    () => (autoplay && !reduced
      ? [Autoplay({ delay, stopOnInteraction: false, stopOnMouseEnter: true, stopOnFocusIn: true })]
      : []),
    [autoplay, delay, reduced],
  );
  const [viewportRef, api] = useEmblaCarousel({ loop, align: "start", duration: reduced ? 0 : 25 }, plugins);
  const [state, setState] = useState({ index: 0, count: 0 });
  const [playing, setPlaying] = useState(autoplay && !reduced);

  useEffect(() => {
    if (!api) return undefined;
    const sync = () => setState({ index: api.selectedScrollSnap(), count: api.scrollSnapList().length });
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

  return (
    <section aria-roledescription="carrusel" aria-label={label} className={clsx("foco-claro", className)}>
      <div ref={viewportRef} className="h-full overflow-hidden">
        <div className="flex h-full touch-pan-y" aria-live={playing ? "off" : "polite"}>
          {slides.map((slide, index) => (
            <div
              key={slide.key ?? index}
              role="group"
              aria-roledescription="diapositiva"
              aria-label={`${index + 1} de ${slides.length}`}
              className="min-w-0 shrink-0 grow-0 basis-full"
            >
              {slide}
            </div>
          ))}
        </div>
      </div>

      {overlay}

      {state.count > 1 && (
        <div className={clsx("absolute inset-x-0 z-10 mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 pb-3 sm:px-6", controlsClassName)}>
          <Dots count={state.count} index={state.index} onSelect={(position) => api?.scrollTo(position)} onDark />
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
      )}
    </section>
  );
}

/* Carrusel de tarjetas con scroll nativo y scroll-snap: swipe táctil, rueda,
   teclado (la pista es enfocable) y además flechas y puntos por página.
   `columns` define cuántas tarjetas caben por ancho de pantalla. */
export function Rail({
  label, header, children,
  columns = "auto-cols-[82%] sm:auto-cols-[calc((100%-1.25rem)/2)] lg:auto-cols-[calc((100%-2.5rem)/3)]",
}) {
  const items = Children.toArray(children);
  const track = useRef(null);
  const [state, setState] = useState({ index: 0, count: 1, prev: false, next: false });

  const sync = useCallback(() => {
    const element = track.current;
    if (!element) return;
    const max = element.scrollWidth - element.clientWidth;
    const count = Math.max(1, Math.round(element.scrollWidth / element.clientWidth));
    const index = max <= 0 ? 0 : Math.min(count - 1, Math.round((element.scrollLeft / max) * (count - 1)));
    setState({ index, count, prev: element.scrollLeft > 4, next: element.scrollLeft < max - 4 });
  }, []);

  useEffect(() => {
    const element = track.current;
    if (!element) return undefined;
    sync();
    element.addEventListener("scroll", sync, { passive: true });
    const observer = new ResizeObserver(sync);
    observer.observe(element);
    return () => { element.removeEventListener("scroll", sync); observer.disconnect(); };
  }, [sync, items.length]);

  const scrollToPage = (page) => {
    const element = track.current;
    const max = element.scrollWidth - element.clientWidth;
    element.scrollTo({ left: state.count > 1 ? (max * page) / (state.count - 1) : 0, behavior: prefersReducedMotion() ? "auto" : "smooth" });
  };

  return (
    <section aria-roledescription="carrusel" aria-label={label}>
      <div className="mb-5 flex items-end justify-between gap-4">
        <div className="min-w-0">{header}</div>
        {state.count > 1 && (
          <div className="hidden shrink-0 gap-2 sm:flex">
            <IconButton icon={ChevronLeft} label="Anterior" tone="solid" disabled={!state.prev} onClick={() => scrollToPage(state.index - 1)} />
            <IconButton icon={ChevronRight} label="Siguiente" tone="solid" disabled={!state.next} onClick={() => scrollToPage(state.index + 1)} />
          </div>
        )}
      </div>
      <ul
        ref={track}
        tabIndex={0}
        aria-label={`${label}: desliza para ver más`}
        className={clsx(
          "-m-3 grid snap-x snap-mandatory scroll-px-3 grid-flow-col gap-5 overflow-x-auto overscroll-x-contain p-3",
          "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          columns,
        )}
      >
        {items.map((item, index) => (
          <li key={item.key ?? index} className="min-w-0 snap-start">{item}</li>
        ))}
      </ul>
      {state.count > 1 && (
        <div className="mt-4 flex justify-center">
          <Dots count={state.count} index={state.index} onSelect={scrollToPage} />
        </div>
      )}
    </section>
  );
}
