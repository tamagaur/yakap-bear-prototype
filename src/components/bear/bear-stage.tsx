"use client";

import dynamic from "next/dynamic";

/**
 * The bear on the simulator page. The 3D renderer (Three.js) needs the browser, so it is
 * loaded on the client only, in its own bundle; while it loads, a same-sized space is kept.
 * Falls back to the 2D bear automatically (no WebGL, renderer error) or by the 2D/3D switch.
 */
export const BearStage = dynamic(() => import("@/components/bear/bear-3d-stage"), {
  ssr: false,
  loading: () => <div className="relative aspect-[4/5] w-full" aria-hidden />,
});
