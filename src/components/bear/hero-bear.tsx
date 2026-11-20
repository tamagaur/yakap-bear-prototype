"use client";

import dynamic from "next/dynamic";
import { Bear } from "@/components/bear/bear-figure";

/**
 * The bear in the home-page hero: the same 3D plush as the simulator, standing by with its
 * heart light green. The flat bear is server-rendered first and stays if WebGL is unavailable,
 * so the hero never shows an empty space.
 */
const flat = <Bear expression="happy" motion="breathe" className="w-full" />;

const Stage = dynamic(() => import("@/components/bear/bear-3d-stage"), {
  ssr: false,
  loading: () => flat,
});

export function HeroBear({ className }: { className?: string }) {
  return (
    <Stage
      mood="idle"
      led="green"
      shakeKey={0}
      holding={false}
      speaking={false}
      controls={false}
      fallback={flat}
      className={className}
    />
  );
}
