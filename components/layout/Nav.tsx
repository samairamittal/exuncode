"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef, type ComponentProps, type MouseEvent, type ReactNode } from "react";
import { NavStatus } from "../handsfree/NavStatus";
import { usePageTransition } from "./PageTransition";
import { ScrambleText, type ScrambleHandle } from "./ScrambleText";

const focusRing =
  "rounded-full outline-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-exun-blue";

// TODO(design): confirm which page each design label opens.
export const navLinks = [
  { href: "/lens", label: "eXunLens", grow: "grow-(--nav-gap-lens)" },
  { href: "/map", label: "eXunTrace", grow: "grow-(--nav-gap-trace)" },
  { href: "/board", label: "eXunCrux", grow: "grow-(--nav-gap-crux)" },
] as const;

/** Link that runs the page transition on a plain left click. */
function TransitionLink({ href, children, ...rest }: ComponentProps<typeof Link> & { href: string; children?: ReactNode }) {
  const navigate = usePageTransition();
  const pathname = usePathname();
  const onClick = (e: MouseEvent<HTMLAnchorElement>) => {
    rest.onClick?.(e);
    if (!navigate || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    navigate(href);
  };
  return (
    <Link href={href} aria-current={pathname === href ? "page" : undefined} {...rest} onClick={onClick}>
      {children}
    </Link>
  );
}

function ScrambleLink({ href, label }: { href: string; label: string }) {
  const scramble = useRef<ScrambleHandle>(null);
  return (
    <TransitionLink
      href={href}
      data-anim={`nav-link-${label}`}
      className={`${focusRing} relative bottom-(--nav-text-dy) text-nav leading-none text-snow active:opacity-70 aria-[current=page]:text-exun-blue`}
      onPointerEnter={() => scramble.current?.play()}
      onFocus={() => scramble.current?.play()}
    >
      <ScrambleText ref={scramble} text={label} />
    </TransitionLink>
  );
}

function SearchIcon() {
  // Drawn to match design/home.png within the 74px button.
  return (
    <svg viewBox="0 0 74 74" className="size-full" aria-hidden>
      <circle cx="32" cy="33" r="8.5" fill="none" stroke="currentColor" strokeWidth="3" />
      <path d="M41.5 42 48 50" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function Nav() {
  // design/exuntrace.png draws the nav 8px higher than design/home.png.
  const raised = usePathname() === "/map";
  return (
    <header
      data-anim="nav-bar"
      className={`absolute inset-x-0 top-0 z-hud pr-(--nav-inset-r) pl-(--nav-inset-l) ${raised ? "pt-(--nav-top-trace)" : "pt-(--nav-top)"}`}
    >
      <nav
        aria-label="Main"
        data-anim="nav"
        className="flex h-(--nav-h) items-center rounded-(--nav-radius) border border-line bg-void pr-(--nav-pad-r) pl-(--nav-pad-l)"
      >
        <TransitionLink href="/" aria-label="Home" data-anim="nav-logo" className={`${focusRing} relative top-(--nav-logo-dy) shrink-0`}>
          {/* eslint-disable-next-line @next/next/no-img-element -- 2x pixel render of the design logo */}
          <img src="/home/logo.png" alt="" width={60} height={46} className="block h-(--nav-logo-h) w-(--nav-logo-w) [image-rendering:pixelated]" />
        </TransitionLink>

        <form
          role="search"
          data-anim="nav-search"
          onSubmit={(e) => e.preventDefault()}
          className="relative ml-(--nav-logo-gap) flex h-(--search-h) w-(--search-w) shrink-0 items-center rounded-full bg-surface-1"
        >
          <button
            type="submit"
            aria-label="Search"
            data-anim="nav-search-button"
            className={`${focusRing} absolute top-1/2 left-(--search-btn-x) size-(--search-btn) -translate-y-1/2 rounded-full bg-exun-blue text-void transition-transform duration-200 ease-out hover:scale-105 active:scale-95`}
          >
            <SearchIcon />
          </button>
          <input
            type="search"
            name="q"
            placeholder="Search"
            aria-label="Search"
            className="hidden h-full w-full rounded-full bg-transparent pb-[calc(var(--nav-text-dy)*2)] pl-(--search-text-x) text-nav text-snow outline-none placeholder:text-snow focus-visible:outline-2 focus-visible:outline-exun-blue md:block"
          />
        </form>

        <span aria-hidden className="grow-(--nav-gap-search) basis-0" />
        {navLinks.map((link, i) => (
          <span key={link.href} className="contents">
            <ScrambleLink href={link.href} label={link.label} />
            {i === navLinks.length - 1 ? (
              // Hands-free status sits centred in the last gap without changing the layout.
              <span className={`${link.grow} relative basis-0`}>
                <span className="absolute top-1/2 left-1/2 -translate-1/2 max-md:hidden">
                  <NavStatus />
                </span>
              </span>
            ) : (
              <span aria-hidden className={`${link.grow} basis-0`} />
            )}
          </span>
        ))}

        <TransitionLink
          href="/profile"
          aria-label="Investigator profile"
          data-anim="nav-avatar"
          className={`${focusRing} block size-(--avatar) shrink-0 border-(length:--avatar-ring) border-exun-blue bg-surface-2 transition-transform duration-200 ease-out hover:scale-105 active:scale-95`}
        />
      </nav>
    </header>
  );
}
