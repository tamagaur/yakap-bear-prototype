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
 * Fur is drawn with shell texturing: each furry part is drawn ~20 times, each shell a little
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

const FUR = { root: "#9c5c2b", tip: "#efb67c" };
const CREAM = { root: "#e6c59a", tip: "#fff4e2" };
const C = {
  pad: "#f3d5ae",
  bean: "#c98e5c",
  thread: "#3a2219",
  eye: "#0d0907",
  collar: "#2c8c80",
  collarDeep: "#23746a",
  ring: "#4cc3c9",
  ringSoft: "#9adfe6",
  blush: "#f2a19a",
};

const LED: Record<LedColor, { color: string; glow: (t: number) => number }> = {
  green: { color: "#56c98a", glow: () => 1.0 },
  blue: { color: "#7cc8f2", glow: (t) => 0.55 + 0.45 * Math.sin(t * 3) },
  amber: { color: "#f2a33a", glow: (t) => (Math.sin(t * 6) > 0 ? 1.4 : 0.08) },
  gray: { color: "#a9b8c0", glow: () => 0.05 },
};

// ── Fur (shell texturing) ──────────────────────────────────────────────────────

let strandTexture: THREE.DataTexture | null = null;

/** Strand heights: per-texel random height, gathered into soft tufts. */
function strands() {
  if (strandTexture) return strandTexture;
  const size = 256;
  const data = new Uint8Array(size * size * 4);
  // Value noise on a 24×24 grid (wrapping), smoothly interpolated: irregular tufts, no visible pattern.
  const grid = 24;
  const cells = Array.from({ length: grid * grid }, () => Math.random());
  const cell = (gx: number, gy: number) => cells[((gy + grid) % grid) * grid + ((gx + grid) % grid)];
  const smooth = (t: number) => t * t * (3 - 2 * t);
  const tuft = (x: number, y: number) => {
    const fx = (x / size) * grid;
    const fy = (y / size) * grid;
    const x0 = Math.floor(fx);
    const y0 = Math.floor(fy);
    const tx = smooth(fx - x0);
    const ty = smooth(fy - y0);
    const top = cell(x0, y0) * (1 - tx) + cell(x0 + 1, y0) * tx;
    const bottom = cell(x0, y0 + 1) * (1 - tx) + cell(x0 + 1, y0 + 1) * tx;
    return top * (1 - ty) + bottom * ty;
  };
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const h = Math.random() * (0.62 + 0.38 * tuft(x, y));
      const v = Math.floor(Math.min(1, h) * 255);
      const i = (y * size + x) * 4;
      data[i] = data[i + 1] = data[i + 2] = v;
      data[i + 3] = 255;
    }
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.needsUpdate = true;
  strandTexture = tex;
  return tex;
}

const FUR_VERTEX = /* glsl */ `
  uniform float uShell;
  uniform float uLength;
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    vec3 p = position + normal * uLength * uShell;
    p.y -= uLength * 0.35 * uShell * uShell; // tips settle a little, like real plush
    vUv = uv;
    vNormal = normalize(normalMatrix * normal);
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    vView = -mv.xyz;
    gl_Position = projectionMatrix * mv;
  }
`;

const FUR_FRAGMENT = /* glsl */ `
  uniform sampler2D uStrands;
  uniform vec2 uRepeat;
  uniform float uShell;
  uniform vec3 uRoot;
  uniform vec3 uTip;
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    float h = texture2D(uStrands, vUv * uRepeat).r;
    if (uShell > 0.0 && h < uShell) discard;
    vec3 n = normalize(vNormal);
    vec3 v = normalize(vView);
    // Camera-fixed key light from the upper right + soft wrap-around fill (matches the scene lights).
    vec3 key = normalize(vec3(0.45, 0.65, 0.6));
    float wrap = clamp((dot(n, key) + 0.55) / 1.55, 0.0, 1.0);
    float fill = clamp((dot(n, normalize(vec3(-0.6, 0.2, 0.75))) + 1.0) * 0.5, 0.0, 1.0);
    vec3 base = mix(uRoot, uTip, smoothstep(0.0, 1.0, uShell));
    float occlusion = mix(0.42, 1.0, pow(uShell, 0.7));
    vec3 color = base * (0.32 + 0.78 * wrap + 0.18 * fill) * occlusion;
    // Velvet sheen at grazing angles brightens the fluffy silhouette.
    float rim = pow(1.0 - clamp(dot(n, v), 0.0, 1.0), 2.4);
    color += uTip * rim * 0.55 * uShell;
    gl_FragColor = vec4(color, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

function furMaterial(shell: number, length: number, root: string, tip: string, repeat: [number, number]) {
  return new THREE.ShaderMaterial({
    vertexShader: FUR_VERTEX,
    fragmentShader: FUR_FRAGMENT,
    uniforms: {
      uShell: { value: shell },
      uLength: { value: length },
      uStrands: { value: strands() },
      uRepeat: { value: new THREE.Vector2(...repeat) },
      uRoot: { value: new THREE.Color(root) },
      uTip: { value: new THREE.Color(tip) },
    },
  });
}

/** How many shells: fewer on small screens so phones stay smooth. */
const SHELLS = typeof window !== "undefined" && window.innerWidth < 600 ? 12 : 22;

function Fur({
  geometry,
  colors = FUR,
  length = 0.06,
  repeat = [3, 1.6],
  shells = SHELLS,
  position,
  rotation,
  scale,
  children,
}: {
  geometry: THREE.BufferGeometry;
  colors?: { root: string; tip: string };
  length?: number;
  repeat?: [number, number];
  shells?: number;
  position?: [number, number, number] | THREE.Vector3;
  rotation?: [number, number, number];
  scale?: [number, number, number];
  children?: ReactNode;
}) {
  const [rx, ry] = repeat;
  const materials = useMemo(
    () => Array.from({ length: shells }, (_, i) => furMaterial(i / (shells - 1), length, colors.root, colors.tip, [rx, ry])),
    [shells, length, colors.root, colors.tip, rx, ry],
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

const HEAD = { y: 1.12, rx: 0.95, ry: 0.85, rz: 0.82 };
/** Point on the head's front surface (head-local coordinates). */
function headSurface(x: number, y: number, lift = 0) {
  const k = 1 - (x / HEAD.rx) ** 2 - (y / HEAD.ry) ** 2;
  return new THREE.Vector3(x, y, HEAD.rz * Math.sqrt(Math.max(0, k)) + lift);
}

const MUZZLE = { y: -0.22, z: 0.6, rx: 0.4, ry: 0.3, rz: 0.25 };
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
  const bellyZ = 0.3;
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
        <planeGeometry args={[3.2, 2.3]} />
        <meshBasicMaterial map={tex.shadow} transparent depthWrite={false} />
      </mesh>

      <group ref={toy}>
        {/* body */}
        <Fur geometry={geo.body} scale={[1, 1, BODY_DEPTH]} repeat={[4, 2]} />

        {/* belly: cream oval, turquoise rings, speaker grille */}
        <Fur
          geometry={geo.sphere}
          colors={CREAM}
          length={0.03}
          shells={12}
          repeat={[5, 2.4]}
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
        <Fur geometry={geo.sphere} position={[0, -0.5, -bodyFrontZ(-0.5) - 0.06]} scale={[0.17, 0.16, 0.15]} length={0.07} repeat={[2, 1]} />
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
            repeat={[2.4, 1.3]}
          >
            <group position={[0, -0.01, 0.47]}>
              <PawPad scale={1.05} />
            </group>
          </Fur>
        ))}

        {/* short chubby arms; the right paw (viewer's right) holds the squeeze sensor */}
        {[-1, 1].map((side) => (
          <group key={side} ref={side === 1 ? pawArm : undefined} position={[side * 0.72, 0.3, 0.3]} rotation={[-0.75, 0, side * 0.55]}>
            <Fur geometry={geo.arm} position={[0, -0.27, 0]} repeat={[2, 1.4]} />
            <group position={[0, -0.47, 0.13]} rotation={[0.7, 0, 0]}>
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
          <Fur geometry={geo.sphere} scale={[HEAD.rx, HEAD.ry, HEAD.rz]} repeat={[4, 2]} />

          {/* ears with cream inner panels */}
          {[-1, 1].map((side) => (
            <group key={side} position={[side * 0.68, 0.6, -0.08]} rotation={[0, side * -0.3, side * -0.25]}>
              <Fur geometry={geo.sphere} scale={[0.27, 0.27, 0.16]} repeat={[2, 1]} />
              <Fur
                geometry={geo.sphere}
                colors={CREAM}
                length={0.02}
                shells={8}
                position={[0, -0.02, 0.12]}
                scale={[0.16, 0.16, 0.05]}
                repeat={[1.5, 1]}
              />
            </group>
          ))}

          {/* glossy safety eyes */}
          {[-1, 1].map((side) => (
            <group key={side} position={headSurface(side * 0.31, 0.04, 0.012)} rotation={[-0.08, side * 0.38, 0]}>
              <mesh scale={[1, 1.06, 0.72]}>
                <sphereGeometry args={[0.1, 36, 28]} />
                <meshPhysicalMaterial color={C.eye} roughness={0.05} clearcoat={1} clearcoatRoughness={0.02} />
              </mesh>
              <mesh position={[-0.03, 0.04, 0.066]}>
                <sphereGeometry args={[0.022, 16, 12]} />
                <meshBasicMaterial color="#ffffff" toneMapped={false} />
              </mesh>
              <mesh position={[0.025, -0.03, 0.068]}>
                <sphereGeometry args={[0.009, 12, 8]} />
                <meshBasicMaterial color="#ffffff" toneMapped={false} />
              </mesh>
            </group>
          ))}

          {/* rosy cheeks (dyed fabric) */}
          {[-1, 1].map((side) => (
            <mesh key={side} position={headSurface(side * 0.55, -0.16, 0.05)} rotation={[0, side * 0.75, 0]} scale={[1, 0.72, 0.2]}>
              <sphereGeometry args={[0.13, 24, 16]} />
              <meshBasicMaterial color={C.blush} transparent opacity={0.38} depthWrite={false} />
            </mesh>
          ))}

          {/* muzzle, nose, mouth */}
          <Fur
            geometry={geo.sphere}
            colors={CREAM}
            length={0.022}
            shells={10}
            position={[0, MUZZLE.y, MUZZLE.z]}
            scale={[MUZZLE.rx, MUZZLE.ry, MUZZLE.rz]}
            repeat={[2.5, 1.4]}
          />
          <mesh position={[0, -0.1, muzzleZ(0, -0.1, 0.035)]} rotation={[-0.35, 0, 0]} geometry={geo.nose}>
            <meshStandardMaterial color="#2c1710" roughness={0.55} />
          </mesh>
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
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
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
