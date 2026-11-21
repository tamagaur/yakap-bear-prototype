"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { useMemo, useRef, type MutableRefObject, type ReactNode } from "react";
import * as THREE from "three";
import type { BearMood, LedColor } from "@/components/bear/bear-figure";

/**
 * The Yakap Bear device in 3D (bear simulator, task S1).
 *
 * A premium plush teddy with electronics inside — not a creature. The toy itself never moves or
 * changes expression (glossy safety eyes, embroidered nose and mouth). Only the device reacts:
 *   • heart pendant = status light (green connected · blue reminder · amber low battery · gray off)
 *   • belly speaker = turquoise rings; sound waves while a reminder plays
 *   • right paw     = squeeze sensor (glows; the plush compresses while held)
 *   • vibration     = reminder buzz, short buzz when a squeeze isn't counted
 * It sits on a slow display turntable and can be dragged to turn.
 *
 * Fur is drawn with shell texturing: each furry part is drawn ~28 times (14 on phones), each shell a little
 * further out along the surface normal, keeping only the pixels where a strand is still tall
 * enough. No model file, no extra libraries. All rules (3-second hold, dose window, reminders,
 * battery) stay in use-bear-device.ts / use-hold-gesture.ts.
 */

export interface Bear3DProps {
  mood: BearMood;
  led: LedColor;
  shakeKey: number;
  holding: boolean;
  speaking: boolean;
  reducedMotion: boolean;
  /** Horizontal drag offset in radians, written by the stage (drag to turn the bear). */
  dragYawRef: MutableRefObject<number>;
  draggingRef: MutableRefObject<boolean>;
}

// Warm milk-chocolate teddy plush; the cream snout, belly and inner ears stand out against it.
const FUR = { root: "#6e3d1d", tip: "#b67a4a" };
const CREAM = { root: "#efdcbd", tip: "#fffaf2" };
const C = {
  pad: "#f3d5ae",
  bean: "#c98e5c",
  thread: "#3a2219",
  eye: "#0d0907",
  collar: "#2c8c80",
  collarDeep: "#23746a",
  ring: "#4cc3c9",
  ringSoft: "#9adfe6",

};

const LED: Record<LedColor, { color: string; glow: (t: number) => number }> = {
  green: { color: "#56c98a", glow: () => 1.0 },
  blue: { color: "#7cc8f2", glow: (t) => 0.55 + 0.45 * Math.sin(t * 3) },
  amber: { color: "#f2a33a", glow: (t) => (Math.sin(t * 6) > 0 ? 1.4 : 0.08) },
  gray: { color: "#a9b8c0", glow: () => 0.05 },
};

// ── Fur (shell texturing) ──────────────────────────────────────────────────────
//
// Strands are drawn procedurally in the shader: each cell of a grid laid over the part's UVs holds
// one round strand that tapers toward its tip, leans a little with its neighbours (soft clumps) and
// is shaded softer toward its edge, so the plush reads as soft and fluffy instead of grainy.

const FUR_VERTEX = /* glsl */ `
  uniform float uShell;
  uniform float uLength;
  uniform float uGravity;
  uniform vec3 uInvScale;
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vView;
  varying vec3 vObj;
  void main() {
    // uInvScale undoes the part's own scale, so fur is equally long on big and small parts.
    vec3 p = position + normal * uLength * uShell * uInvScale;
    p.y -= uLength * uGravity * uShell * uShell * uInvScale.y; // tips settle a little, like real plush
    vUv = uv;
    vObj = position;
    vNormal = normalize(normalMatrix * normal);
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    vView = -mv.xyz;
    gl_Position = projectionMatrix * mv;
  }
`;

const FUR_FRAGMENT = /* glsl */ `
  uniform float uShell;
  uniform vec2 uCells;
  uniform float uLean;
  uniform vec3 uRoot;
  uniform vec3 uTip;
  uniform float uPatchOn;
  uniform vec3 uPatchAt;
  uniform float uPatchR;
  uniform float uPatchH;
  uniform vec3 uPatchRoot;
  uniform vec3 uPatchTip;
  uniform float uBlushOn;
  uniform vec3 uBlush0;
  uniform vec3 uBlush1;
  uniform float uBlushR;
  uniform vec3 uBlushColor;
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vView;
  varying vec3 vObj;

  float hash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }
  // Value noise that wraps around U (no seam where the UVs meet).
  float noiseU(vec2 p, float period) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float x0 = mod(i.x, period);
    float x1 = mod(i.x + 1.0, period);
    float a = hash(vec2(x0, i.y));
    float b = hash(vec2(x1, i.y));
    float c = hash(vec2(x0, i.y + 1.0));
    float d = hash(vec2(x1, i.y + 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }

  void main() {
    vec2 uv = vUv * uCells;
    float period = uCells.x / 9.0;
    vec2 tuftUv = uv / 9.0;
    float tuft = noiseU(tuftUv * 2.0 + 5.0, period * 2.0);
    // Strands lean together in soft clumps, more toward their tips.
    vec2 lean = vec2(noiseU(tuftUv, period), noiseU(tuftUv + 31.7, period)) - 0.5;
    uv -= lean * uLean * uShell;
    vec2 cell = floor(uv);
    vec2 f = fract(uv) - 0.5;
    vec2 jitter = vec2(hash(cell + 3.1), hash(cell + 9.7)) - 0.5;
    float d = length(f - jitter * 0.35);

    // Inner-ear style panel: a different colour and a shorter pile.
    float pm = uPatchOn * (1.0 - smoothstep(uPatchR * 0.9, uPatchR, distance(vObj, uPatchAt)));
    float height = (0.6 + 0.4 * hash(cell)) * (0.72 + 0.28 * tuft) * mix(1.0, uPatchH, pm);

    // Each strand is shaded darker toward its edge, which reads as soft and round. (The fur stays
    // fully opaque: see-through strand edges would let the page behind show through the canvas.)
    float edge = 1.0;
    if (uShell > 0.0) {
      if (uShell > height) discard;
      float radius = 0.6 * (1.0 - uShell / height) + 0.08; // round strands that taper to a soft tip
      if (d > radius) discard;
      edge = mix(0.86, 1.0, 1.0 - smoothstep(radius * 0.35, radius, d));
    }

    vec3 n = normalize(vNormal);
    vec3 v = normalize(vView);
    // Camera-fixed key light from the upper right + soft wrap-around fill (matches the scene lights).
    vec3 key = normalize(vec3(0.45, 0.65, 0.6));
    float wrap = clamp((dot(n, key) + 0.6) / 1.6, 0.0, 1.0);
    float fill = clamp((dot(n, normalize(vec3(-0.6, 0.2, 0.75))) + 1.0) * 0.5, 0.0, 1.0);

    vec3 root = mix(uRoot, uPatchRoot, pm);
    vec3 tip = mix(uTip, uPatchTip, pm);
    vec3 base = mix(root, tip, smoothstep(0.0, 0.9, uShell));
    base *= 0.95 + 0.1 * tuft; // gentle tonal variation, like real plush
    // Dyed rosy cheeks.
    float blush = uBlushOn * max(
      1.0 - smoothstep(0.0, uBlushR, distance(vObj, uBlush0)),
      1.0 - smoothstep(0.0, uBlushR, distance(vObj, uBlush1))
    );
    base = mix(base, uBlushColor, blush * 0.42);

    float occlusion = mix(0.56, 1.0, pow(uShell, 0.6));
    vec3 color = base * (0.36 + 0.66 * wrap + 0.14 * fill) * occlusion * edge;
    // Soft sheen on the strand tips.
    float spec = pow(clamp(dot(n, normalize(key + v)), 0.0, 1.0), 16.0);
    color += mix(vec3(1.0, 0.9, 0.76), tip, 0.4) * spec * 0.12 * uShell;
    // Backlit halo along the silhouette: the "fluffy" edge.
    float rim = pow(1.0 - clamp(dot(n, v), 0.0, 1.0), 2.0);
    color += mix(tip, vec3(1.0, 0.9, 0.78), 0.15) * rim * 0.45 * pow(uShell, 1.3);

    gl_FragColor = vec4(color, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

type Vec3 = [number, number, number];
type FurColors = { root: string; tip: string };
/** A differently coloured, shorter-pile area of one fur part (e.g. the inside of an ear). */
type FurPatch = { at: Vec3; radius: number; colors: FurColors; height: number };

/** Distance between strands, in scene units. */
const STRAND = 0.015;

/** Strand grid size for a part whose UVs span `span` scene units (U wraps, so it stays a multiple of 9). */
function strandCells([u, v]: [number, number]): [number, number] {
  return [Math.max(9, Math.round(u / STRAND / 9) * 9), Math.max(4, Math.round(v / STRAND))];
}

/** UV span of an ellipsoid built from the unit sphere. */
function ellipsoidSpan(rx: number, ry: number, rz: number): [number, number] {
  const r = (rx + ry + rz) / 3;
  return [2 * Math.PI * r, Math.PI * r];
}

const BLUSH_COLOR = "#f2a5a0";

function furMaterial(
  shell: number,
  o: {
    length: number;
    cells: [number, number];
    colors: FurColors;
    invScale: Vec3;
    lean: number;
    gravity: number;
    patch?: FurPatch;
    blush?: [Vec3, Vec3];
    blushRadius: number;
  },
) {
  const patch = o.patch;
  return new THREE.ShaderMaterial({
    vertexShader: FUR_VERTEX,
    fragmentShader: FUR_FRAGMENT,
    uniforms: {
      uShell: { value: shell },
      uLength: { value: o.length },
      uGravity: { value: o.gravity },
      uInvScale: { value: new THREE.Vector3(...o.invScale) },
      uCells: { value: new THREE.Vector2(...o.cells) },
      uLean: { value: o.lean },
      uRoot: { value: new THREE.Color(o.colors.root) },
      uTip: { value: new THREE.Color(o.colors.tip) },
      uPatchOn: { value: patch ? 1 : 0 },
      uPatchAt: { value: new THREE.Vector3(...(patch?.at ?? [0, 0, 0])) },
      uPatchR: { value: patch?.radius ?? 0 },
      uPatchH: { value: patch?.height ?? 1 },
      uPatchRoot: { value: new THREE.Color(patch?.colors.root ?? o.colors.root) },
      uPatchTip: { value: new THREE.Color(patch?.colors.tip ?? o.colors.tip) },
      uBlushOn: { value: o.blush ? 1 : 0 },
      uBlush0: { value: new THREE.Vector3(...(o.blush?.[0] ?? [0, 0, 0])) },
      uBlush1: { value: new THREE.Vector3(...(o.blush?.[1] ?? [0, 0, 0])) },
      uBlushR: { value: o.blushRadius },
      uBlushColor: { value: new THREE.Color(BLUSH_COLOR) },
    },
  });
}

/** How many shells: fewer on small screens so phones stay smooth. */
const SHELLS = typeof window !== "undefined" && window.innerWidth < 600 ? 14 : 28;

function Fur({
  geometry,
  span,
  colors = FUR,
  length = 0.062,
  shells = SHELLS,
  lean = 1.1,
  gravity = 0.4,
  patch,
  blush,
  blushRadius = 0.22,
  position,
  rotation,
  scale = [1, 1, 1],
  children,
}: {
  geometry: THREE.BufferGeometry;
  /** Size of the part's UV area in scene units (sets how many strands it gets). */
  span: [number, number];
  colors?: FurColors;
  /** Fur length in scene units, the same on every part whatever its scale. */
  length?: number;
  shells?: number;
  lean?: number;
  gravity?: number;
  patch?: FurPatch;
  /** Cheek centres in the part's own (unscaled) coordinates. */
  blush?: [Vec3, Vec3];
  blushRadius?: number;
  position?: Vec3 | THREE.Vector3;
  rotation?: Vec3;
  scale?: Vec3;
  children?: ReactNode;
}) {
  const key = JSON.stringify({ span, colors, length, shells, lean, gravity, patch, blush, blushRadius, scale });
  const materials = useMemo(
    () => {
      const o = JSON.parse(key) as {
        span: [number, number];
        colors: FurColors;
        length: number;
        shells: number;
        lean: number;
        gravity: number;
        patch?: FurPatch;
        blush?: [Vec3, Vec3];
        blushRadius: number;
        scale: Vec3;
      };
      const opts = {
        length: o.length,
        cells: strandCells(o.span),
        colors: o.colors,
        invScale: o.scale.map((s) => 1 / s) as Vec3,
        lean: o.lean,
        gravity: o.gravity,
        patch: o.patch,
        blush: o.blush,
        blushRadius: o.blushRadius,
      };
      return Array.from({ length: o.shells }, (_, i) => furMaterial(i / (o.shells - 1), opts));
    },
    [key],
  );
  return (
    <group position={position} rotation={rotation}>
      <group scale={scale}>
        {materials.map((m, i) => (
          <mesh key={i} geometry={geometry} material={m} />
        ))}
      </group>
      {children}
    </group>
  );
}

// ── Shared shapes ──────────────────────────────────────────────────────────────

const BODY_DEPTH = 0.88;
const BODY_PROFILE = new THREE.SplineCurve(
  [
    [0.001, -0.8],
    [0.52, -0.78],
    [0.82, -0.6],
    [0.93, -0.3],
    [0.9, 0.0],
    [0.78, 0.28],
    [0.57, 0.52],
    [0.3, 0.66],
    [0.001, 0.7],
  ].map(([x, y]) => new THREE.Vector2(x, y)),
).getPoints(64);

/** Front surface depth of the (pear-shaped) body at height y. */
function bodyFrontZ(y: number) {
  for (let i = 1; i < BODY_PROFILE.length; i += 1) {
    const a = BODY_PROFILE[i - 1];
    const b = BODY_PROFILE[i];
    if ((y - a.y) * (y - b.y) <= 0) {
      const t = b.y === a.y ? 0 : (y - a.y) / (b.y - a.y);
      return (a.x + (b.x - a.x) * t) * BODY_DEPTH;
    }
  }
  return 0;
}

// A big round head over a smaller body, like a baby-proportioned teddy.
const HEAD = { y: 1.1, rx: 1.0, ry: 0.88, rz: 0.84 };
/** Point on the head's front surface (head-local coordinates). */
function headSurface(x: number, y: number, lift = 0) {
  const k = 1 - (x / HEAD.rx) ** 2 - (y / HEAD.ry) ** 2;
  return new THREE.Vector3(x, y, HEAD.rz * Math.sqrt(Math.max(0, k)) + lift);
}

// A small, rounded snout that stands out from the face fur.
const MUZZLE = { y: -0.25, z: 0.64, rx: 0.36, ry: 0.27, rz: 0.26 };
function muzzleZ(x: number, y: number, lift = 0) {
  const k = 1 - (x / MUZZLE.rx) ** 2 - ((y - MUZZLE.y) / MUZZLE.ry) ** 2;
  return MUZZLE.z + MUZZLE.rz * Math.sqrt(Math.max(0, k)) + lift;
}

function heartGeometry(size: number, depth: number) {
  const s = new THREE.Shape();
  s.moveTo(0, -0.5);
  s.bezierCurveTo(-0.12, -0.38, -0.5, -0.16, -0.5, 0.12);
  s.bezierCurveTo(-0.5, 0.4, -0.18, 0.52, 0, 0.3);
  s.bezierCurveTo(0.18, 0.52, 0.5, 0.4, 0.5, 0.12);
  s.bezierCurveTo(0.5, -0.16, 0.12, -0.38, 0, -0.5);
  const g = new THREE.ExtrudeGeometry(s, {
    depth,
    bevelEnabled: true,
    bevelThickness: depth * 0.9,
    bevelSize: 0.09,
    bevelSegments: 8,
    curveSegments: 32,
  });
  g.center();
  g.scale(size, size, size);
  return g;
}

function noseGeometry() {
  const s = new THREE.Shape();
  s.moveTo(-0.5, 0.22);
  s.quadraticCurveTo(0, 0.44, 0.5, 0.22);
  s.quadraticCurveTo(0.58, 0.08, 0.14, -0.3);
  s.quadraticCurveTo(0, -0.42, -0.14, -0.3);
  s.quadraticCurveTo(-0.58, 0.08, -0.5, 0.22);
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.1, bevelEnabled: true, bevelThickness: 0.1, bevelSize: 0.08, bevelSegments: 6 });
  g.center();
  g.scale(0.24, 0.2, 0.3);
  return g;
}

let shadowTexture: THREE.CanvasTexture | null = null;
let grilleTexture: THREE.CanvasTexture | null = null;

function canvasTexture(w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void) {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (ctx) draw(ctx);
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function textures() {
  shadowTexture ??= canvasTexture(128, 128, (ctx) => {
    const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, "rgba(96,58,30,0.42)");
    g.addColorStop(0.55, "rgba(96,58,30,0.16)");
    g.addColorStop(1, "rgba(96,58,30,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
  });
  grilleTexture ??= canvasTexture(256, 256, (ctx) => {
    const g = ctx.createRadialGradient(128, 110, 10, 128, 128, 128);
    g.addColorStop(0, "#dcbb92");
    g.addColorStop(1, "#b98f63");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(128, 128, 128, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(90,58,34,0.55)";
    for (let y = 12; y < 256; y += 16) {
      for (let x = 12 + ((y / 16) % 2) * 8; x < 256; x += 16) {
        if ((x - 128) ** 2 + (y - 128) ** 2 < 108 ** 2) {
          ctx.beginPath();
          ctx.arc(x, y, 3.4, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  });
  return { shadow: shadowTexture, grille: grilleTexture };
}

// ── Small parts ────────────────────────────────────────────────────────────────

/** Embroidered mouth: thread from the nose down, then a soft ∪ to each side. */
function Mouth() {
  const tubes = useMemo(() => {
    const lift = 0.03;
    const pt = (x: number, y: number) => new THREE.Vector3(x, y, muzzleZ(x, y, lift));
    const make = (pts: THREE.Vector3[]) => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.011, 8, false);
    return [
      make([pt(0, -0.17), pt(0, -0.215), pt(0, -0.255)]),
      make([pt(0, -0.255), pt(-0.055, -0.305), pt(-0.12, -0.282)]),
      make([pt(0, -0.255), pt(0.055, -0.305), pt(0.12, -0.282)]),
    ];
  }, []);
  return (
    <>
      {tubes.map((g, i) => (
        <mesh key={i} geometry={g}>
          <meshStandardMaterial color={C.thread} roughness={0.75} />
        </mesh>
      ))}
    </>
  );
}

/** Soft sewn paw pad: one big pad and three toe beans. */
function PawPad({ scale = 1, glowRef }: { scale?: number; glowRef?: MutableRefObject<THREE.MeshStandardMaterial | null> }) {
  const beans: [number, number, number][] = [
    [-0.085, 0.075, 0.048],
    [0, 0.105, 0.05],
    [0.085, 0.075, 0.048],
  ];
  return (
    <group scale={scale}>
      <mesh scale={[0.2, 0.2, 0.05]}>
        <sphereGeometry args={[1, 32, 20]} />
        <meshPhysicalMaterial color={C.pad} roughness={0.85} sheen={1} sheenColor="#fff4e4" sheenRoughness={0.6} />
      </mesh>
      <mesh position={[0, -0.03, 0.035]} scale={[0.1, 0.085, 0.03]}>
        <sphereGeometry args={[1, 28, 16]} />
        <meshStandardMaterial ref={glowRef} color={C.bean} emissive="#f0b24a" emissiveIntensity={0.02} roughness={0.7} />
      </mesh>
      {beans.map(([x, y, r], i) => (
        <mesh key={i} position={[x, y, 0.035]} scale={[1, 0.9, 0.55]}>
          <sphereGeometry args={[r, 20, 14]} />
          <meshStandardMaterial color={C.bean} roughness={0.7} />
        </mesh>
      ))}
    </group>
  );
}

/** Expanding rings: sound from the speaker, or the "dose logged" pulse from the pendant. */
function Rings({
  active,
  color,
  origin,
  speed = 1.1,
  maxScale = 3.4,
  radius = 0.13,
}: {
  active: boolean;
  color: string;
  origin: [number, number, number];
  speed?: number;
  maxScale?: number;
  radius?: number;
}) {
  const refs = useRef<(THREE.Mesh | null)[]>([]);
  useFrame(({ clock }) => {
    refs.current.forEach((mesh, i) => {
      if (!mesh) return;
      mesh.visible = active;
      if (!active) return;
      const p = (((clock.elapsedTime * speed + i / 3) % 1) + 1) % 1;
      const s = 1 + p * (maxScale - 1);
      mesh.scale.set(s, s, s);
      mesh.position.z = origin[2] + p * 0.22;
      (mesh.material as THREE.MeshBasicMaterial).opacity = (1 - p) * 0.6;
    });
  });
  return (
    <>
      {[0, 1, 2].map((i) => (
        <mesh
          key={i}
          ref={(m) => {
            refs.current[i] = m;
          }}
          position={origin}
          visible={false}
        >
          <torusGeometry args={[radius, 0.009, 8, 64]} />
          <meshBasicMaterial color={color} transparent depthWrite={false} toneMapped={false} />
        </mesh>
      ))}
    </>
  );
}

// ── The toy ────────────────────────────────────────────────────────────────────

function YakapBear({ mood, led, shakeKey, holding, speaking, reducedMotion, dragYawRef, draggingRef }: Bear3DProps) {
  const turntable = useRef<THREE.Group>(null);
  const toy = useRef<THREE.Group>(null);
  const pawArm = useRef<THREE.Group>(null);
  const heartMat = useRef<THREE.MeshPhysicalMaterial>(null);
  const sensorMat = useRef<THREE.MeshStandardMaterial | null>(null);
  const squeeze = useRef(0);
  const buzz = useRef<{ key: number; until: number }>({ key: shakeKey, until: -1 });

  const geo = useMemo(
    () => ({
      sphere: new THREE.SphereGeometry(1, 64, 48),
      // Spheres turned so their poles (where strands bunch up) face forward/back: hidden under the
      // snout and at the back of the head, and under the inner-ear panel.
      headSphere: new THREE.SphereGeometry(1, 72, 54).rotateX(1.86),
      frontSphere: new THREE.SphereGeometry(1, 48, 36).rotateX(Math.PI / 2),
      body: new THREE.LatheGeometry(BODY_PROFILE, 72),
      arm: new THREE.CapsuleGeometry(0.21, 0.26, 12, 32),
      heart: heartGeometry(0.36, 0.1),
      nose: noseGeometry(),
    }),
    [],
  );
  const tex = textures();
  const light = LED[led] ?? LED.gray;
  const pendantColor = mood === "happy" ? LED.green.color : light.color;

  // Belly panel (cream short-pile oval) and the speaker in its centre.
  const bellyY = -0.3;
  const bellyZ = 0.34;
  const speakerZ = bellyZ + 0.6 + 0.03;

  useFrame(({ clock }, delta) => {
    const t = clock.elapsedTime;

    // The plush compresses while the paw sensor is squeezed (eases in/out).
    squeeze.current = THREE.MathUtils.damp(squeeze.current, holding ? 1 : 0, 10, delta);
    const h = squeeze.current;

    // Vibration motor: reminder pattern (0.45 s on / 0.9 s off), short buzz for an ignored squeeze.
    if (shakeKey !== buzz.current.key) buzz.current = { key: shakeKey, until: t + 0.35 };
    const reminderBuzz = mood === "reminder" && t % 1.35 < 0.45;
    const vibrating = !reducedMotion && (reminderBuzz || t < buzz.current.until);

    if (toy.current) {
      toy.current.scale.set(1 + 0.03 * h, 1 - 0.05 * h, 1 + 0.03 * h);
      toy.current.position.x = vibrating ? Math.sin(t * 95) * 0.008 : 0;
      toy.current.rotation.z = vibrating ? Math.sin(t * 83) * 0.006 : 0;
    }

    if (turntable.current) {
      const idle = reducedMotion ? 0 : Math.sin(t * 0.35) * 0.32;
      const target = draggingRef.current ? dragYawRef.current : idle + dragYawRef.current;
      turntable.current.rotation.y = THREE.MathUtils.damp(turntable.current.rotation.y, target, draggingRef.current ? 18 : 2.5, delta);
      if (!draggingRef.current) dragYawRef.current = THREE.MathUtils.damp(dragYawRef.current, 0, 1.2, delta);
    }

    if (pawArm.current) {
      // The squeezed paw presses in toward the body.
      pawArm.current.scale.set(1 + 0.08 * h, 1 - 0.08 * h, 1 + 0.08 * h);
      pawArm.current.position.x = 0.72 - 0.04 * h;
    }
    if (sensorMat.current) sensorMat.current.emissiveIntensity = 0.02 + 0.95 * h;
    if (heartMat.current) heartMat.current.emissiveIntensity = mood === "happy" ? 1.3 + 0.35 * Math.sin(t * 8) : light.glow(t);
  });

  return (
    <group ref={turntable}>
      <mesh position={[0, -0.97, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[2.6, 1.9]} />
        <meshBasicMaterial map={tex.shadow} transparent depthWrite={false} />
      </mesh>

      <group ref={toy}>
        {/* body */}
        <Fur geometry={geo.body} span={[2 * Math.PI * 0.86, 2.3]} scale={[1, 1, BODY_DEPTH]} />

        {/* belly: cream short-pile oval, turquoise rings, speaker grille */}
        <Fur
          geometry={geo.sphere}
          span={ellipsoidSpan(0.62, 0.62, 0.6)}
          colors={CREAM}
          length={0.032}
          shells={12}
          lean={0.8}
          position={[0, bellyY, bellyZ]}
          scale={[0.62, 0.62, 0.6]}
        />
        <group position={[0, bellyY - 0.02, speakerZ]}>
          <mesh>
            <circleGeometry args={[0.12, 48]} />
            <meshStandardMaterial map={tex.grille} roughness={0.9} />
          </mesh>
          {/* rings sit on the curved belly: the bigger the ring, the further back */}
          <mesh position={[0, 0, -0.035]}>
            <torusGeometry args={[0.155, 0.018, 12, 72]} />
            <meshStandardMaterial color={C.ring} roughness={0.45} emissive={C.ring} emissiveIntensity={0.12} />
          </mesh>
          <mesh position={[0, 0, -0.07]}>
            <torusGeometry args={[0.24, 0.014, 12, 72]} />
            <meshStandardMaterial color={C.ringSoft} roughness={0.45} emissive={C.ringSoft} emissiveIntensity={0.12} />
          </mesh>
        </group>
        <Rings active={speaking || mood === "reminder"} color="#5fd0d6" origin={[0, bellyY - 0.02, speakerZ + 0.01]} />

        {/* back: little round tail and a USB-C charging port */}
        <Fur
          geometry={geo.sphere}
          span={ellipsoidSpan(0.17, 0.16, 0.15)}
          position={[0, -0.5, -bodyFrontZ(-0.5) - 0.06]}
          scale={[0.17, 0.16, 0.15]}
          length={0.075}
        />
        <group position={[0, -0.18, -bodyFrontZ(-0.18) - 0.05]} rotation={[0, Math.PI, 0]}>
          <mesh>
            <boxGeometry args={[0.16, 0.075, 0.03]} />
            <meshStandardMaterial color="#e2cdb2" roughness={0.9} />
          </mesh>
          <mesh position={[0, 0, 0.018]}>
            <boxGeometry args={[0.085, 0.028, 0.012]} />
            <meshStandardMaterial color="#2a2a2a" metalness={0.6} roughness={0.35} />
          </mesh>
        </group>

        {/* legs (sitting) with toe-bean foot pads */}
        {[-1, 1].map((side) => (
          <Fur
            key={side}
            geometry={geo.sphere}
            position={[side * 0.46, -0.6, 0.36]}
            rotation={[0, side * -0.16, 0]}
            scale={[0.34, 0.31, 0.44]}
            span={ellipsoidSpan(0.34, 0.31, 0.44)}
          >
            <group position={[0, -0.01, 0.5]}>
              <PawPad scale={1.05} />
            </group>
          </Fur>
        ))}

        {/* short chubby arms; the right paw (viewer's right) holds the squeeze sensor */}
        {[-1, 1].map((side) => (
          <group key={side} ref={side === 1 ? pawArm : undefined} position={[side * 0.72, 0.3, 0.3]} rotation={[-0.75, 0, side * 0.55]}>
            <Fur geometry={geo.arm} span={[2 * Math.PI * 0.21, 0.26 + Math.PI * 0.21]} position={[0, -0.27, 0]} length={0.045} />
            <group position={[0, -0.5, 0.19]} rotation={[0.7, 0, 0]}>
              <PawPad scale={0.72} glowRef={side === 1 ? sensorMat : undefined} />
            </group>
          </group>
        ))}

        {/* collar, bow and the heart pendant (the status light) */}
        <group position={[0, 0.5, 0.02]}>
          <mesh rotation={[Math.PI / 2 - 0.1, 0, 0]} scale={[1, 0.9, 1]}>
            <torusGeometry args={[0.74, 0.09, 24, 96]} />
            <meshPhysicalMaterial color={C.collar} roughness={0.5} sheen={0.8} sheenColor="#a8e4d8" />
          </mesh>
          <group position={[0, -0.05, 0.69]} rotation={[0.12, 0, 0]}>
            {[-1, 1].map((side) => (
              <mesh key={side} position={[side * 0.13, 0, 0]} rotation={[0, 0, side * 0.3]} scale={[1.35, 0.85, 0.5]}>
                <sphereGeometry args={[0.11, 28, 20]} />
                <meshPhysicalMaterial color={C.collar} roughness={0.5} sheen={0.8} sheenColor="#a8e4d8" />
              </mesh>
            ))}
            <mesh scale={[0.85, 0.85, 0.65]}>
              <sphereGeometry args={[0.07, 20, 16]} />
              <meshPhysicalMaterial color={C.collarDeep} roughness={0.55} />
            </mesh>
            {/* bail */}
            <mesh position={[0, -0.11, 0.08]} rotation={[0, Math.PI / 2, 0]}>
              <torusGeometry args={[0.03, 0.009, 8, 24]} />
              <meshStandardMaterial color="#d8e6ea" metalness={0.7} roughness={0.25} />
            </mesh>
            <mesh position={[0, -0.29, 0.1]} rotation={[-0.3, 0, 0]} geometry={geo.heart}>
              <meshPhysicalMaterial
                ref={heartMat}
                color={pendantColor}
                emissive={pendantColor}
                emissiveIntensity={0.4}
                roughness={0.15}
                clearcoat={1}
                clearcoatRoughness={0.08}
              />
            </mesh>
            {led !== "gray" && <pointLight position={[0, -0.29, 0.5]} color={pendantColor} intensity={0.5} distance={0.6} />}
            <Rings active={mood === "happy"} color={LED.green.color} origin={[0, -0.29, 0.2]} speed={0.9} maxScale={2.8} radius={0.16} />
          </group>
        </group>

        {/* head — fixed toy face */}
        <group position={[0, HEAD.y, 0.02]}>
          {/* head fur, with rosy cheeks dyed into the plush */}
          <Fur
            geometry={geo.headSphere}
            span={ellipsoidSpan(HEAD.rx, HEAD.ry, HEAD.rz)}
            scale={[HEAD.rx, HEAD.ry, HEAD.rz]}
            length={0.058}
            blush={[
              [-0.5, -0.23, 0.84],
              [0.5, -0.23, 0.84],
            ]}
          />

          {/* big round ears with cream inner panels (short pile) */}
          {[-1, 1].map((side) => (
            <group key={side} position={[side * 0.7, 0.62, -0.06]} rotation={[0, side * -0.3, side * -0.25]}>
              <Fur
                geometry={geo.frontSphere}
                span={ellipsoidSpan(0.31, 0.3, 0.17)}
                scale={[0.31, 0.3, 0.17]}
                length={0.055}
                patch={{ at: [0, -0.12, 0.99], radius: 0.64, colors: CREAM, height: 0.35 }}
              />
            </group>
          ))}

          {/* glossy safety eyes, set low and wide for a sweet look */}
          {[-1, 1].map((side) => (
            <group key={side} position={headSurface(side * 0.3, -0.02, 0.02)} rotation={[-0.08, side * 0.36, 0]}>
              <mesh scale={[1, 1.08, 0.72]}>
                <sphereGeometry args={[0.098, 36, 28]} />
                <meshPhysicalMaterial color={C.eye} roughness={0.05} clearcoat={1} clearcoatRoughness={0.02} />
              </mesh>
              {/* warm brown iris ring, like real plush safety eyes */}
              <mesh position={[0, 0, 0.069]} scale={[1, 1.08, 1]}>
                <ringGeometry args={[0.052, 0.074, 40]} />
                <meshPhysicalMaterial color="#3b2416" roughness={0.1} clearcoat={1} transparent opacity={0.85} />
              </mesh>
              <mesh position={[-0.032, 0.042, 0.068]}>
                <sphereGeometry args={[0.027, 16, 12]} />
                <meshBasicMaterial color="#ffffff" toneMapped={false} />
              </mesh>
              <mesh position={[0.028, -0.032, 0.07]}>
                <sphereGeometry args={[0.012, 12, 8]} />
                <meshBasicMaterial color="#ffffff" toneMapped={false} />
              </mesh>
            </group>
          ))}

          {/* muzzle, nose, mouth */}
          <Fur
            geometry={geo.sphere}
            span={ellipsoidSpan(MUZZLE.rx, MUZZLE.ry, MUZZLE.rz)}
            colors={CREAM}
            length={0.026}
            shells={12}
            lean={0.8}
            position={[0, MUZZLE.y, MUZZLE.z]}
            scale={[MUZZLE.rx, MUZZLE.ry, MUZZLE.rz]}
          />
          <group position={[0, -0.1, muzzleZ(0, -0.1, 0.035)]} rotation={[-0.35, 0, 0]}>
            <mesh geometry={geo.nose}>
              <meshStandardMaterial color="#2a150d" roughness={0.6} />
            </mesh>
            {/* soft shine on the stitched nose */}
            <mesh position={[-0.028, 0.03, 0.05]} scale={[1.5, 0.7, 0.4]}>
              <sphereGeometry args={[0.014, 12, 8]} />
              <meshBasicMaterial color="#ffffff" transparent opacity={0.22} depthWrite={false} toneMapped={false} />
            </mesh>
          </group>
          <Mouth />
        </group>
      </group>
    </group>
  );
}

export default function Bear3D(props: Bear3DProps) {
  return (
    <Canvas
      dpr={[1, 2]}
      camera={{ fov: 30, position: [0, 0.75, 6.5], near: 0.1, far: 50 }}
      // Neutral tone mapping keeps the warm caramel and teal colours rich (the default film curve greys them).
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance", toneMapping: THREE.NeutralToneMapping }}
      onCreated={({ camera }) => camera.lookAt(0, 0.52, 0)}
      style={{ touchAction: "pan-y" }}
    >
      <hemisphereLight args={["#fff6e8", "#c99a6e", 1.15]} />
      <directionalLight position={[3, 5, 4]} intensity={1.9} color="#fff1dc" />
      <directionalLight position={[-4, 1.5, 3]} intensity={0.55} color="#ffe9d2" />
      <directionalLight position={[0, 3, -4]} intensity={0.8} color="#ffffff" />
      <YakapBear {...props} />
    </Canvas>
  );
}
