"use client";

import { gsap } from "gsap";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { bus } from "@/lib/events";
import { duration, ease, stagger, transition, useReducedMotion } from "@/lib/motion";
import { clearReturningHome, markReturningHome, runLeave, setTransitioning } from "@/lib/motion/transition";

type Navigate = (href: string) => void;

const TransitionContext = createContext<Navigate | null>(null);

/** Navigate with the page transition. Falls back to plain navigation outside the provider. */
export function usePageTransition(): Navigate | null {
  return useContext(TransitionContext);
}

function useCellGrid() {
  const [grid, setGrid] = useState({ cols: 0, rows: 0 });
  useEffect(() => {
    const measure = () =>
      setGrid({
        cols: Math.ceil(window.innerWidth / transition.cell),
        rows: Math.ceil(window.innerHeight / transition.cell),
      });
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);
  return grid;
}

/**
 * Pixel-dissolve overlay. On navigate: the current page's leave animation runs,
 * cells dissolve in, the route changes, cells dissolve out, then
 * "transition:revealed" is emitted so the new page can finish its entrance.
 */
export function PageTransition({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const reduced = useReducedMotion();
  const { cols, rows } = useCellGrid();
  const overlayRef = useRef<HTMLDivElement>(null);
  const fadeRef = useRef<HTMLDivElement>(null);
  const busy = useRef(false);
  const pathnameRef = useRef(pathname);
  const pending = useRef<{ href: string; resolve: () => void } | null>(null);

  useEffect(() => {
    pathnameRef.current = pathname;
    if (pending.current?.href === pathname) {
      pending.current.resolve();
      pending.current = null;
    }
  }, [pathname]);

  const cover = useCallback(
    (show: boolean) =>
      new Promise<void>((resolve) => {
        const overlay = overlayRef.current;
        if (!overlay) return resolve();
        if (reduced) {
          gsap.to(fadeRef.current, {
            opacity: show ? 1 : 0,
            duration: duration.fade,
            ease: ease.inOut,
            onComplete: resolve,
          });
          return;
        }
        gsap.to(overlay.querySelectorAll('[data-anim="dissolve-cell"]'), {
          opacity: show ? 1 : 0,
          duration: show ? transition.dissolveIn : transition.dissolveOut,
          ease: "steps(1)",
          stagger: { amount: stagger.dissolve, from: "random", grid: [rows, cols] },
          onComplete: resolve,
        });
      }),
    [reduced, rows, cols],
  );

  const navigate = useCallback<Navigate>(
    async (href) => {
      if (busy.current || href === pathnameRef.current) return;
      busy.current = true;
      setTransitioning(true);
      const overlay = overlayRef.current;
      if (overlay) overlay.style.pointerEvents = "auto";
      try {
        if (!reduced) await runLeave(href);
        await cover(true);
        if (href === "/") markReturningHome();
        await new Promise<void>((resolve) => {
          pending.current = { href, resolve };
          router.push(href);
          window.setTimeout(resolve, transition.routeTimeoutMs);
        });
        await cover(false);
        setTransitioning(false);
        bus.emit("transition:revealed", { pathname: href });
      } finally {
        setTransitioning(false);
        clearReturningHome();
        busy.current = false;
        if (overlay) overlay.style.pointerEvents = "none";
      }
    },
    [cover, reduced, router],
  );

  return (
    <TransitionContext.Provider value={navigate}>
      {children}
      <div
        ref={overlayRef}
        data-anim="transition-overlay"
        aria-hidden
        className="pointer-events-none fixed inset-0 z-transition grid overflow-hidden"
        // Whole-pixel cells (overflowing the edge) so no hairline seams show between them.
        style={{
          gridTemplateColumns: `repeat(${cols}, ${transition.cell}px)`,
          gridTemplateRows: `repeat(${rows}, ${transition.cell}px)`,
        }}
      >
        {Array.from({ length: cols * rows }, (_, i) => (
          <div key={i} data-anim="dissolve-cell" className="bg-void opacity-0" />
        ))}
        <div ref={fadeRef} data-anim="transition-fade" className="absolute inset-0 bg-void opacity-0" />
      </div>
    </TransitionContext.Provider>
  );
}
