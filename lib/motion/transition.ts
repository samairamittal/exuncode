// Coordinates route transitions between the overlay (components/layout/PageTransition)
// and pages that want their own leave/enter animation (Home's screen zoom).

type LeaveHandler = (to: string) => Promise<void>;

let leaveHandler: LeaveHandler | null = null;
let returningHome = false;
let transitioning = false;

/** A page registers how it animates out. Returns an unregister function. */
export function registerLeave(handler: LeaveHandler): () => void {
  leaveHandler = handler;
  return () => {
    if (leaveHandler === handler) leaveHandler = null;
  };
}

export async function runLeave(to: string): Promise<void> {
  await leaveHandler?.(to);
}

export function markReturningHome(): void {
  returningHome = true;
}

/** True while a transition back to "/" is in progress (cleared once revealed). */
export function isReturningHome(): boolean {
  return returningHome;
}

export function clearReturningHome(): void {
  returningHome = false;
}

export function setTransitioning(on: boolean): void {
  transitioning = on;
}

/** True from a transition link click until "transition:revealed" has been emitted. */
export function isTransitioning(): boolean {
  return transitioning;
}
