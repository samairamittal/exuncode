import type { ComponentProps, ReactNode } from "react";

// The lens1 card: flat dark panel, 40px corners. `outlined` adds lens1's thin frame.

export function Panel({
  anim,
  outlined = false,
  className = "",
  children,
  ...rest
}: ComponentProps<"section"> & { anim: string; outlined?: boolean; children: ReactNode }) {
  return (
    <section
      data-anim={anim}
      className={`relative overflow-hidden rounded-[40px] bg-(--surface-0) ${outlined ? "border border-snow/40" : ""} ${className}`}
      {...rest}
    >
      {children}
    </section>
  );
}

/** Panel title in lens1's style: bold mono, 24px. */
export function PanelTitle({ id, children, aside }: { id: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <header className="flex h-12 items-center justify-between gap-4">
      <h2 id={id} className="text-2xl leading-none font-bold">
        {children}
      </h2>
      {aside && <div className="text-xs leading-none tracking-wider text-snow/50 uppercase">{aside}</div>}
    </header>
  );
}
