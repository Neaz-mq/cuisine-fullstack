"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * src/components/StickySiteHeader.tsx
 *
 * Keeps the customer site's black info bar (hours / address / kitchen status)
 * AND the navbar (logo, links, account, cart) fixed at the top while the page
 * scrolls — the standard "sticky header" pattern.
 *
 * ── Why `position: sticky`, not `position: fixed` ───────────────────────
 * `fixed` takes the header OUT of the page flow, so the first section of
 * every page would slide underneath it and every page would need a
 * hand-tuned top padding. `sticky` keeps the header IN the flow (the page
 * starts right below it, exactly as before) and only pins it once you
 * scroll. No layout jump, no per-page padding.
 *
 * ── Smoothness ──────────────────────────────────────────────────────────
 *  • The header's height NEVER changes while scrolling (no shrinking
 *    animation), so the content below can't jitter or shift.
 *  • The only change on scroll is a soft shadow that fades in (a GPU-cheap
 *    opacity-like transition) so the pinned header reads as floating above
 *    the content. Scroll events are passive and batched per animation frame.
 *  • Respects "reduce motion".
 *
 * ── What it publishes for the rest of the site ──────────────────────────
 * `--site-header-h` on <html>: the height the header covers while pinned.
 *  • globals.css uses it for `scroll-padding-top`, so in-page anchors and
 *    scrollIntoView() land BELOW the header instead of hidden behind it.
 *  • Other sticky things (the account sidebar) use it as their `top`.
 * It is removed again when the header unmounts (leaving the customer site).
 *
 * `pinTopBar={false}` is a one-word switch: the black info bar then scrolls
 * away and only the navbar stays pinned (saves ~44px of screen on phones).
 */
export default function StickySiteHeader({
  topBar,
  navbar,
  pinTopBar = true,
}: {
  topBar: ReactNode;
  navbar: ReactNode;
  /** true = both stay fixed. false = only the navbar stays fixed. */
  pinTopBar?: boolean;
}) {
  const headerRef = useRef<HTMLDivElement>(null);
  const topBarRef = useRef<HTMLDivElement>(null);
  const [scrolled, setScrolled] = useState(false);

  // Measure → publish the pinned height as a CSS variable (no React state,
  // so a resize never re-renders the header).
  useEffect(() => {
    const header = headerRef.current;
    const topBarEl = topBarRef.current;
    if (!header) return;
    const root = document.documentElement;

    const measure = () => {
      const topBarHeight = topBarEl?.offsetHeight ?? 0;
      header.style.setProperty("--site-topbar-h", `${topBarHeight}px`);
      const pinnedHeight = pinTopBar ? header.offsetHeight : header.offsetHeight - topBarHeight;
      root.style.setProperty("--site-header-h", `${pinnedHeight}px`);
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(header);
    if (topBarEl) observer.observe(topBarEl);

    return () => {
      observer.disconnect();
      root.style.removeProperty("--site-header-h");
    };
  }, [pinTopBar]);

  // Shadow once the page has moved. Passive + one update per frame.
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      // If the info bar scrolls away, the navbar only becomes "stuck" after it.
      const threshold = pinTopBar ? 4 : (topBarRef.current?.offsetHeight ?? 0);
      setScrolled(window.scrollY > threshold);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };

    // Also covers a reload that restores a scrolled position.
    frame = requestAnimationFrame(update);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [pinTopBar]);

  return (
    <div
      ref={headerRef}
      data-scrolled={scrolled}
      // z-40: above page content, below every modal/dialog (z-50+) and the
      // AI assistant (z-60). Its own dropdowns (account menu, mobile menu)
      // live inside this stacking context, so they sit above the page too.
      className={`sticky top-0 z-40 w-full transition-shadow duration-200 motion-reduce:transition-none print:static ${
        scrolled ? "shadow-[0_8px_24px_rgba(0,0,0,0.08)]" : "shadow-none"
      }`}
      style={pinTopBar ? undefined : { top: "calc(-1 * var(--site-topbar-h, 0px))" }}
    >
      <div ref={topBarRef}>{topBar}</div>
      {navbar}
    </div>
  );
}
