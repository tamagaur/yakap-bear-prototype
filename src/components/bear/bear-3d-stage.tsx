"use client";

import clsx from "clsx";
import { Component, useRef, useState, type PointerEvent, type ReactNode } from "react";
import Bear3D from "@/components/bear/bear-3d";
import { BearFigure, type BearMood, type LedColor } from "@/components/bear/bear-figure";

/**
 * Bear simulator stage: the 3D bear, with the original 2D bear as a fallback.
 * Loaded only in the browser (see bear-stage.tsx), so it can read WebGL support and the
 * saved 2D/3D choice directly.
 */

const VIEW_KEY = "yakap.bear.view";
const MOOD_LABEL: Record<BearMood, string> = {
  idle: "Yakap Bear plush device, standing by",
  reminder: "Yakap Bear device: reminder playing from the speaker, heart light blue, vibrating",
  happy: "Yakap Bear device: dose recorded, heart light flashing green",
  ignored: "Yakap Bear device: the squeeze was not counted (short buzz)",
  sleepy: "Yakap Bear device: battery low, heart light blinking amber",
};

function supportsWebGL(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

function readView(): "3d" | "2d" {
  try {
    return window.localStorage.getItem(VIEW_KEY) === "2d" ? "2d" : "3d";
  } catch {
    return "3d";
  }
}

function saveView(view: "3d" | "2d") {
  try {
    window.localStorage.setItem(VIEW_KEY, view);
  } catch {
    // Private mode / blocked storage: the choice just isn't remembered.
  }
}

/** If the 3D renderer fails at runtime (lost GPU context, old driver), show the 2D bear. */
class Fallback extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

export default function Bear3DStage({
  mood,
  led,
  shakeKey,
  holding,
  speaking,
  className,
}: {
  mood: BearMood;
  led: LedColor;
  shakeKey: number;
  holding: boolean;
  speaking: boolean;
  className?: string;
}) {
  const [webgl] = useState(supportsWebGL);
  const [view, setView] = useState(readView);
  const [reducedMotion] = useState(() => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false);
  const dragYawRef = useRef(0);
  const draggingRef = useRef(false);
  const lastX = useRef(0);

  const flat = <BearFigure mood={mood} led={led} shakeKey={shakeKey} className="relative w-full" />;
  const show3d = webgl && view === "3d";

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    draggingRef.current = true;
    lastX.current = e.clientX;
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    const dx = e.clientX - lastX.current;
    lastX.current = e.clientX;
    dragYawRef.current = Math.max(-1.1, Math.min(1.1, dragYawRef.current + dx * 0.012));
  };
  const endDrag = () => {
    draggingRef.current = false;
  };

  const toggle = () => {
    const next = view === "3d" ? "2d" : "3d";
    setView(next);
    saveView(next);
  };

  return (
    <div className={clsx("relative", className)}>
      {show3d ? (
        <Fallback fallback={flat}>
          <div
            role="img"
            aria-label={`${MOOD_LABEL[mood]}. 3D view — drag to turn the bear.`}
            title="Drag to turn the bear"
            className="relative aspect-[4/5] w-full cursor-grab touch-pan-y active:cursor-grabbing"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            onLostPointerCapture={endDrag}
          >
            <Bear3D
              mood={mood}
              led={led}
              shakeKey={shakeKey}
              holding={holding}
              speaking={speaking}
              reducedMotion={reducedMotion}
              dragYawRef={dragYawRef}
              draggingRef={draggingRef}
            />
          </div>
        </Fallback>
      ) : (
        flat
      )}
      {!webgl && (
        <p className="mt-1 text-center text-[11px] font-semibold text-cocoa-600">
          3D view unavailable here (turn on graphics acceleration in the browser) — showing the 2D bear.
        </p>
      )}
      {webgl && (
        <button
          type="button"
          onClick={toggle}
          className="absolute -top-2 -left-10 rounded-full border border-cocoa-200 bg-white/85 px-2.5 py-1 text-[11px] font-extrabold tracking-[0.06em] text-cocoa-700 shadow-sm hover:bg-white mobile:-left-12"
          aria-label={view === "3d" ? "Show the flat 2D bear" : "Show the 3D bear"}
        >
          {view === "3d" ? "2D" : "3D"}
        </button>
      )}
    </div>
  );
}
