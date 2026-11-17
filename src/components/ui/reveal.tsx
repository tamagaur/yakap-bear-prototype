"use client";

import clsx from "clsx";
import { useEffect, useRef, type CSSProperties, type ReactNode, type Ref } from "react";

const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Scroll reveal: content rises softly into place as it enters the viewport.
 *
 * Content is visible by default (no JavaScript, reduced motion, or already on
 * screen). Only elements that start below the fold are hidden, off screen, and
 * shown when they scroll in. Use `delay` to stagger siblings.
 */
export function Reveal({
  as = "div",
  children,
  className,
  delay = 0,
  from,
  id,
}: {
  as?: "div" | "section" | "li" | "article" | "p";
  children: ReactNode;
  className?: string;
  /** Milliseconds; stagger siblings with 0, 80, 160… */
  delay?: number;
  from?: "left" | "right" | "scale";
  id?: string;
}) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || reducedMotion() || !("IntersectionObserver" in window)) return;
    if (el.getBoundingClientRect().top < window.innerHeight * 0.92) return; // already in view

    // Hide without animating (it's off screen), then let the transition play on reveal.
    el.style.transition = "none";
    el.dataset.reveal = "pending";
    void el.offsetHeight;
    el.style.transition = "";

    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          el.dataset.reveal = "shown";
          io.disconnect();
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -6% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // One element type for typing; the rendered tag is whatever `as` says.
  const Tag = as as "div";
  return (
    <Tag
      ref={ref as Ref<HTMLDivElement>}
      id={id}
      className={clsx("reveal", className)}
      data-reveal-from={from}
      style={{ "--reveal-delay": `${delay}ms` } as CSSProperties}
    >
      {children}
    </Tag>
  );
}

/**
 * Scroll parallax: the element drifts at a fraction of the scroll speed, so
 * layers separate and the page gains depth. `fade` also dims it as it leaves.
 * No effect with reduced motion.
 */
export function Parallax({
  speed = 0.15,
  fade = false,
  className,
  children,
}: {
  /** Positive drifts down (feels further away); negative floats up. */
  speed?: number;
  fade?: boolean;
  className?: string;
  children?: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || reducedMotion()) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const y = Math.min(window.scrollY, 1000);
      el.style.transform = `translate3d(0, ${(y * speed).toFixed(1)}px, 0)`;
      // Stay fully readable at first; dim only once the element is on its way out.
      if (fade) el.style.opacity = String(Math.max(0.2, 1 - Math.max(0, y - 170) / 500));
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(frame);
    };
  }, [speed, fade]);

  return (
    <div ref={ref} className={className} style={{ willChange: "transform" }}>
      {children}
    </div>
  );
}
