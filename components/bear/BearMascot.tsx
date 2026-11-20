import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, Defs, Ellipse, G, LinearGradient, Path, RadialGradient, Stop } from 'react-native-svg';

import { useReducedMotion } from '@/hooks/useReducedMotion';

/**
 * Yakap Bear mascot: a chubby plush teddy drawn in layered SVG so each part
 * (body, arms, head, eyes) can animate on its own. Everything is local vector
 * art, so it stays crisp at any size and works in Expo Go.
 */

const VIEW_BOX = '0 0 200 220';
const ASPECT = 220 / 200;

export const bearPalette = {
  furLight: '#E4B07A',
  fur: '#C98A55',
  furShade: '#A86C3D',
  furDeep: '#8C5631',
  creamLight: '#FFF6E6',
  cream: '#F3DDBD',
  creamShade: '#E6C49A',
  earLight: '#F8CDB8',
  ear: '#E3A48A',
  nose: '#4A2C1E',
  ink: '#3A241A',
  blush: '#F29E96',
  tongue: '#E98585',
  heart: '#EF8F8A',
  honey: '#E6B337',
  sage: '#327F72',
};

const c = bearPalette;

/**
 * Expressions and poses:
 * - idle: soft smile, resting paws
 * - happy: closed smiling eyes, open smile
 * - excited: big sparkly eyes, paws out, twinkles
 * - celebrating: both paws up, hearts and twinkles
 * - listening: head tilt, little "o" mouth, sound waves by the ear
 * - sleepy: peaceful closed eyes
 * - comfort: gentle closed eyes, hugging a heart (empty states)
 */
export type BearMood = 'idle' | 'happy' | 'excited' | 'celebrating' | 'listening' | 'sleepy' | 'comfort';

interface BearMascotProps {
  size?: number;
  mood?: BearMood;
  /** Very gentle drift. Kept subtle on purpose. */
  floating?: boolean;
  /** Waves on arrival and again every few seconds. */
  waving?: boolean;
  /** Change this value to play a short cheer, such as after a dose is confirmed. */
  celebrateKey?: number | string;
  style?: StyleProp<ViewStyle>;
}

/* ---------- SVG building blocks ---------- */

function BearDefs() {
  return (
    <Defs>
      <RadialGradient id="ybFur" cx="40%" cy="30%" r="78%">
        <Stop offset="0" stopColor={c.furLight} />
        <Stop offset="0.55" stopColor={c.fur} />
        <Stop offset="1" stopColor={c.furShade} />
      </RadialGradient>
      <RadialGradient id="ybCream" cx="50%" cy="32%" r="72%">
        <Stop offset="0" stopColor={c.creamLight} />
        <Stop offset="1" stopColor={c.cream} />
      </RadialGradient>
      <RadialGradient id="ybEar" cx="50%" cy="40%" r="65%">
        <Stop offset="0" stopColor={c.earLight} />
        <Stop offset="1" stopColor={c.ear} />
      </RadialGradient>
      <LinearGradient id="ybLimb" x1="0" y1="0" x2="0" y2="1">
        <Stop offset="0" stopColor={c.fur} />
        <Stop offset="1" stopColor={c.furShade} />
      </LinearGradient>
      <RadialGradient id="ybHeart" cx="40%" cy="35%" r="70%">
        <Stop offset="0" stopColor="#F8B4AE" />
        <Stop offset="1" stopColor={c.heart} />
      </RadialGradient>
    </Defs>
  );
}

function Layer({ size, children }: { size: number; children: React.ReactNode }) {
  return (
    <Svg width={size} height={size * ASPECT} viewBox={VIEW_BOX} style={StyleSheet.absoluteFill}>
      <BearDefs />
      {children}
    </Svg>
  );
}

const heartPath = (x: number, y: number, s: number) =>
  `M${x} ${y + s * 0.9} C${x - s * 1.25} ${y + s * 0.05} ${x - s * 0.95} ${y - s * 0.95} ${x} ${y - s * 0.35} ` +
  `C${x + s * 0.95} ${y - s * 0.95} ${x + s * 1.25} ${y + s * 0.05} ${x} ${y + s * 0.9} Z`;

const sparklePath = (x: number, y: number, s: number) =>
  `M${x} ${y - s} Q${x + s * 0.18} ${y - s * 0.18} ${x + s} ${y} Q${x + s * 0.18} ${y + s * 0.18} ${x} ${y + s} ` +
  `Q${x - s * 0.18} ${y + s * 0.18} ${x - s} ${y} Q${x - s * 0.18} ${y - s * 0.18} ${x} ${y - s} Z`;

function Body() {
  return (
    <G>
      <Ellipse cx={100} cy={170} rx={51} ry={43} fill="url(#ybFur)" />
      {/* plush seams */}
      <Path d="M62 150 q4 -4 8 -2" stroke={c.furLight} strokeWidth={2} strokeLinecap="round" opacity={0.5} fill="none" />
      <Path d="M132 150 q4 -2 7 2" stroke={c.furLight} strokeWidth={2} strokeLinecap="round" opacity={0.5} fill="none" />
      <Ellipse cx={100} cy={179} rx={31} ry={27} fill="url(#ybCream)" />
      <Path d={heartPath(100, 178, 6.5)} fill={c.blush} opacity={0.75} />
    </G>
  );
}

function Feet() {
  return (
    <G>
      <Ellipse cx={73} cy={204} rx={20} ry={12.5} fill="url(#ybFur)" />
      <Ellipse cx={127} cy={204} rx={20} ry={12.5} fill="url(#ybFur)" />
      <Ellipse cx={73} cy={206.5} rx={10} ry={6.5} fill={c.cream} />
      <Ellipse cx={127} cy={206.5} rx={10} ry={6.5} fill={c.cream} />
      {[66, 73, 80].map((x) => (
        <Circle key={`l${x}`} cx={x} cy={x === 73 ? 197.5 : 199} r={2.4} fill={c.cream} />
      ))}
      {[120, 127, 134].map((x) => (
        <Circle key={`r${x}`} cx={x} cy={x === 127 ? 197.5 : 199} r={2.4} fill={c.cream} />
      ))}
    </G>
  );
}

function Arm({ side }: { side: 'left' | 'right' }) {
  const x = side === 'left' ? 55 : 145;
  const tilt = side === 'left' ? 16 : -16;
  return (
    <G rotation={tilt} originX={x} originY={160}>
      <Ellipse cx={x} cy={163} rx={13.5} ry={22} fill="url(#ybLimb)" />
      <Ellipse cx={x} cy={178} rx={8.5} ry={6.5} fill={c.cream} opacity={0.95} />
    </G>
  );
}

function Head() {
  return (
    <G>
      {/* ears */}
      <Circle cx={47} cy={43} r={23} fill="url(#ybFur)" />
      <Circle cx={153} cy={43} r={23} fill="url(#ybFur)" />
      <Circle cx={49} cy={46} r={13} fill="url(#ybEar)" />
      <Circle cx={151} cy={46} r={13} fill="url(#ybEar)" />
      {/* head */}
      <Ellipse cx={100} cy={89} rx={71} ry={62} fill="url(#ybFur)" />
      {/* little tuft and plush texture */}
      <Path d="M95 29 Q99 20 104 27 Q107 21 111 28" stroke={c.furShade} strokeWidth={2.6} strokeLinecap="round" fill="none" opacity={0.55} />
      <G stroke={c.furLight} strokeWidth={1.8} strokeLinecap="round" opacity={0.45}>
        <Path d="M60 62 l4 -3" />
        <Path d="M66 70 l4 -2" />
        <Path d="M136 62 l-4 -3" />
        <Path d="M132 71 l-4 -2" />
        <Path d="M118 44 l3 -3" />
      </G>
      {/* muzzle */}
      <Ellipse cx={100} cy={113} rx={31} ry={23} fill="url(#ybCream)" />
      {/* cheeks */}
      <Ellipse cx={65} cy={112} rx={10.5} ry={6.5} fill={c.blush} opacity={0.5} />
      <Ellipse cx={135} cy={112} rx={10.5} ry={6.5} fill={c.blush} opacity={0.5} />
      {/* nose */}
      <Path d="M90.5 104.5 C90.5 98.5 109.5 98.5 109.5 104.5 C109.5 109.5 103.5 112.5 100 112.5 C96.5 112.5 90.5 109.5 90.5 104.5 Z" fill={c.nose} />
      <Ellipse cx={96.5} cy={103} rx={3.4} ry={1.7} fill="#FFFFFF" opacity={0.5} />
      <Path d="M100 112.5 L100 116" stroke={c.ink} strokeWidth={2.6} strokeLinecap="round" />
    </G>
  );
}

type MouthKind = 'smile' | 'open' | 'o' | 'soft';

function Mouth({ kind }: { kind: MouthKind }) {
  switch (kind) {
    case 'open':
      return (
        <G>
          <Path d="M89 116 Q100 134 111 116 Q100 120 89 116 Z" fill={c.ink} />
          <Path d="M94.5 124.5 Q100 130 105.5 124.5 Q100 121.5 94.5 124.5 Z" fill={c.tongue} />
        </G>
      );
    case 'o':
      return <Ellipse cx={100} cy={120.5} rx={3.8} ry={4.4} fill={c.ink} />;
    case 'soft':
      return <Path d="M94 116.5 Q100 121.5 106 116.5" stroke={c.ink} strokeWidth={2.6} strokeLinecap="round" fill="none" />;
    default:
      return (
        <Path
          d="M91 115.5 Q95.5 121.5 100 116 Q104.5 121.5 109 115.5"
          stroke={c.ink}
          strokeWidth={2.6}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      );
  }
}

function OpenEyes({ big, lookUp }: { big?: boolean; lookUp?: boolean }) {
  const rx = big ? 9.6 : 8.6;
  const ry = big ? 11.2 : 10;
  const dy = lookUp ? -1.5 : 0;
  return (
    <G>
      {[76, 124].map((x) => (
        <G key={x}>
          <Ellipse cx={x} cy={90 + dy} rx={rx} ry={ry} fill={c.ink} />
          <Circle cx={x + 3.1} cy={86.2 + dy * 1.6} r={big ? 3.8 : 3.3} fill="#FFFFFF" />
          <Circle cx={x - 2.8} cy={94 + dy} r={1.6} fill="#FFFFFF" opacity={0.85} />
        </G>
      ))}
    </G>
  );
}

function ClosedEyes({ shape }: { shape: 'happy' | 'peaceful' | 'blink' }) {
  const d =
    shape === 'happy'
      ? ['M68 93 Q76 83 84 93', 'M116 93 Q124 83 132 93']
      : shape === 'peaceful'
        ? ['M68 89 Q76 96 84 89', 'M116 89 Q124 96 132 89']
        : ['M67.5 91 Q76 94 84.5 91', 'M115.5 91 Q124 94 132.5 91'];
  return (
    <G stroke={c.ink} strokeWidth={3.6} strokeLinecap="round" fill="none">
      <Path d={d[0]} />
      <Path d={d[1]} />
    </G>
  );
}

/* ---------- Mood configuration ---------- */

interface MoodConfig {
  eyes: 'open' | 'big' | 'up' | 'happy' | 'peaceful';
  mouth: MouthKind;
  /** Resting arm angles in degrees: [left, right]. Positive left / negative right raises outward. */
  arms: [number, number];
  tilt: number;
  sparkles?: boolean;
  hearts?: boolean;
  sound?: boolean;
  hug?: boolean;
}

const MOODS: Record<BearMood, MoodConfig> = {
  idle: { eyes: 'open', mouth: 'smile', arms: [0, 0], tilt: 0 },
  happy: { eyes: 'happy', mouth: 'open', arms: [0, 0], tilt: 0 },
  excited: { eyes: 'big', mouth: 'open', arms: [42, -42], tilt: 0, sparkles: true },
  celebrating: { eyes: 'happy', mouth: 'open', arms: [118, -118], tilt: 0, sparkles: true, hearts: true },
  listening: { eyes: 'up', mouth: 'o', arms: [0, 0], tilt: -6, sound: true },
  sleepy: { eyes: 'peaceful', mouth: 'soft', arms: [0, 0], tilt: 4 },
  comfort: { eyes: 'peaceful', mouth: 'smile', arms: [-36, 36], tilt: 3, hug: true },
};

const toDeg = (value: Animated.Value) =>
  value.interpolate({ inputRange: [-360, 360], outputRange: ['-360deg', '360deg'] });

/* ---------- Component ---------- */

export function BearMascot({ size = 160, mood = 'idle', floating, waving, celebrateKey, style }: BearMascotProps) {
  const reducedMotion = useReducedMotion();
  const config = MOODS[mood];

  const breathe = useRef(new Animated.Value(0)).current;
  const drift = useRef(new Animated.Value(0)).current;
  const blink = useRef(new Animated.Value(0)).current;
  const hop = useRef(new Animated.Value(0)).current;
  const burst = useRef(new Animated.Value(0)).current;
  const twinkle = useRef(new Animated.Value(0)).current;
  const armLeft = useRef(new Animated.Value(config.arms[0])).current;
  const armRight = useRef(new Animated.Value(config.arms[1])).current;
  const tilt = useRef(new Animated.Value(config.tilt)).current;
  const firstCelebrate = useRef(true);

  // Breathing: a slow, soft rise and fall.
  useEffect(() => {
    if (reducedMotion) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breathe, { toValue: 1, duration: 2100, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(breathe, { toValue: 0, duration: 2100, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [breathe, reducedMotion]);

  // Optional drift, deliberately small.
  useEffect(() => {
    if (reducedMotion || !floating) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(drift, { toValue: 1, duration: 2800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(drift, { toValue: 0, duration: 2800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [drift, floating, reducedMotion]);

  // Natural, irregular blinking while the eyes are open.
  const eyesOpen = config.eyes === 'open' || config.eyes === 'big' || config.eyes === 'up';
  useEffect(() => {
    if (reducedMotion || !eyesOpen) return;
    let timer: ReturnType<typeof setTimeout>;
    let alive = true;
    const schedule = () => {
      timer = setTimeout(() => {
        Animated.sequence([
          Animated.timing(blink, { toValue: 1, duration: 70, useNativeDriver: true }),
          Animated.timing(blink, { toValue: 0, duration: 110, useNativeDriver: true }),
        ]).start(() => {
          if (alive) schedule();
        });
      }, 2400 + Math.random() * 3200);
    };
    schedule();
    return () => {
      alive = false;
      clearTimeout(timer);
      blink.setValue(0);
    };
  }, [blink, eyesOpen, reducedMotion]);

  // Arms, head tilt, and waving follow the mood.
  useEffect(() => {
    const [left, right] = config.arms;
    const ease = Easing.inOut(Easing.quad);
    const to = (value: Animated.Value, toValue: number, duration = 380) =>
      Animated.timing(value, { toValue, duration: reducedMotion ? 0 : duration, easing: ease, useNativeDriver: true });

    Animated.parallel([to(armLeft, left), to(tilt, config.tilt)]).start();

    if (reducedMotion) {
      armRight.setValue(right);
      return;
    }

    let loop: Animated.CompositeAnimation | null = null;
    if (waving && mood !== 'celebrating' && mood !== 'comfort') {
      loop = Animated.loop(
        Animated.sequence([
          Animated.delay(400),
          to(armRight, -128, 320),
          to(armRight, -104, 200),
          to(armRight, -130, 200),
          to(armRight, -104, 200),
          to(armRight, -128, 200),
          to(armRight, right, 360),
          Animated.delay(4600),
        ]),
      );
    } else if (mood === 'celebrating') {
      armRight.setValue(right);
      loop = Animated.loop(
        Animated.sequence([
          Animated.parallel([to(armRight, right + 12, 650), to(armLeft, left - 12, 650)]),
          Animated.parallel([to(armRight, right, 650), to(armLeft, left, 650)]),
        ]),
      );
    } else {
      to(armRight, right).start();
    }
    loop?.start();
    return () => loop?.stop();
  }, [armLeft, armRight, config.arms, config.tilt, mood, reducedMotion, tilt, waving]);

  // Gentle twinkles for excited / celebrating / listening.
  const twinkles = Boolean(config.sparkles || config.sound);
  useEffect(() => {
    if (!twinkles) return;
    if (reducedMotion) {
      twinkle.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(twinkle, { toValue: 1, duration: 800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(twinkle, { toValue: 0.25, duration: 800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [reducedMotion, twinkle, twinkles]);

  // A short cheer when celebrateKey changes.
  useEffect(() => {
    if (celebrateKey === undefined) return;
    if (firstCelebrate.current) {
      firstCelebrate.current = false;
      return;
    }
    burst.setValue(0);
    const animations: Animated.CompositeAnimation[] = [
      Animated.timing(burst, { toValue: 1, duration: 1300, easing: Easing.out(Easing.quad), useNativeDriver: true }),
    ];
    if (!reducedMotion) {
      animations.push(
        Animated.sequence([
          Animated.timing(hop, { toValue: 1, duration: 200, easing: Easing.out(Easing.quad), useNativeDriver: true }),
          Animated.timing(hop, { toValue: 0, duration: 320, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        ]),
      );
    }
    Animated.parallel(animations).start();
  }, [burst, celebrateKey, hop, reducedMotion]);

  const height = size * ASPECT;
  const bodyScale = breathe.interpolate({ inputRange: [0, 1], outputRange: [1, 1.025] });
  const headLift = breathe.interpolate({ inputRange: [0, 1], outputRange: [0, -size * 0.008] });
  const driftY = drift.interpolate({ inputRange: [0, 1], outputRange: [0, -size * 0.018] });
  const hopY = hop.interpolate({ inputRange: [0, 1], outputRange: [0, -size * 0.045] });
  const openOpacity = blink.interpolate({ inputRange: [0, 1], outputRange: [1, 0] });
  const burstOpacity = burst.interpolate({ inputRange: [0, 0.12, 0.75, 1], outputRange: [0, 1, 1, 0] });
  const burstY = burst.interpolate({ inputRange: [0, 1], outputRange: [size * 0.06, -size * 0.1] });

  const eyes =
    config.eyes === 'happy' || config.eyes === 'peaceful' ? (
      <ClosedEyes shape={config.eyes} />
    ) : (
      <OpenEyes big={config.eyes === 'big'} lookUp={config.eyes === 'up'} />
    );

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel="Yakap Bear, a cuddly caramel teddy bear"
      style={[{ width: size, height }, style]}
    >
      <Layer size={size}>
        <Ellipse cx={100} cy={214} rx={60} ry={5.5} fill={c.furDeep} opacity={0.14} />
      </Layer>

      <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ translateY: driftY }, { translateY: hopY }] }]}>
        {/* body breathes */}
        <Animated.View style={[StyleSheet.absoluteFill, styles.bodyOrigin, { transform: [{ scaleY: bodyScale }] }]}>
          <Layer size={size}>
            <Body />
          </Layer>
        </Animated.View>

        {/* arms sit behind the head so a raised paw peeks out */}
        <Animated.View style={[StyleSheet.absoluteFill, styles.leftShoulder, { transform: [{ rotate: toDeg(armLeft) }] }]}>
          <Layer size={size}>
            <Arm side="left" />
          </Layer>
        </Animated.View>
        <Animated.View style={[StyleSheet.absoluteFill, styles.rightShoulder, { transform: [{ rotate: toDeg(armRight) }] }]}>
          <Layer size={size}>
            <Arm side="right" />
          </Layer>
        </Animated.View>

        <Layer size={size}>
          <Feet />
          {config.hug ? (
            <G>
              <Path d={heartPath(100, 168, 15)} fill="url(#ybHeart)" />
              <Ellipse cx={94} cy={162} rx={4} ry={2.4} fill="#FFFFFF" opacity={0.55} />
            </G>
          ) : null}
        </Layer>

        {/* head lifts with each breath and tilts with mood */}
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            styles.neck,
            { transform: [{ translateY: headLift }, { rotate: toDeg(tilt) }] },
          ]}
        >
          <Layer size={size}>
            <Head />
            <Mouth kind={config.mouth} />
          </Layer>
          {eyesOpen ? (
            <>
              <Animated.View style={[StyleSheet.absoluteFill, { opacity: openOpacity }]}>
                <Layer size={size}>{eyes}</Layer>
              </Animated.View>
              <Animated.View style={[StyleSheet.absoluteFill, { opacity: blink }]}>
                <Layer size={size}>
                  <ClosedEyes shape="blink" />
                </Layer>
              </Animated.View>
            </>
          ) : (
            <Layer size={size}>{eyes}</Layer>
          )}
        </Animated.View>

        {twinkles ? (
          <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity: twinkle }]}>
            <Layer size={size}>
              {config.sparkles ? (
                <G>
                  <Path d={sparklePath(24, 74, 8)} fill={c.honey} />
                  <Path d={sparklePath(178, 34, 6)} fill={c.honey} />
                  <Path d={sparklePath(182, 128, 5)} fill={c.blush} />
                </G>
              ) : null}
              {config.hearts ? <Path d={heartPath(20, 128, 7)} fill={c.heart} /> : null}
              {config.sound ? (
                <G stroke={c.sage} strokeWidth={3.2} strokeLinecap="round" fill="none">
                  <Path d="M176 62 Q184 74 176 86" />
                  <Path d="M186 54 Q198 74 186 94" opacity={0.6} />
                </G>
              ) : null}
            </Layer>
          </Animated.View>
        ) : null}

        {celebrateKey !== undefined ? (
          <Animated.View
            pointerEvents="none"
            style={[StyleSheet.absoluteFill, { opacity: burstOpacity, transform: [{ translateY: burstY }] }]}
          >
            <Layer size={size}>
              <Path d={heartPath(178, 46, 10)} fill={c.heart} />
              <Path d={heartPath(22, 64, 8)} fill={c.honey} />
              <Path d={sparklePath(160, 16, 6)} fill={c.honey} />
              <Path d={sparklePath(40, 24, 5)} fill={c.blush} />
            </Layer>
          </Animated.View>
        ) : null}
      </Animated.View>
    </View>
  );
}

/** A small, still bear face for avatars and list rows. */
export function BearFace({ size = 44, mood = 'idle' }: { size?: number; mood?: 'idle' | 'happy' | 'sleepy' }) {
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width={size} height={size} viewBox="18 14 164 142">
        <BearDefs />
        <Head />
        <Mouth kind={mood === 'happy' ? 'open' : mood === 'sleepy' ? 'soft' : 'smile'} />
        {mood === 'idle' ? <OpenEyes /> : <ClosedEyes shape={mood === 'happy' ? 'happy' : 'peaceful'} />}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  bodyOrigin: { transformOrigin: '50% 96%' },
  leftShoulder: { transformOrigin: '29% 66%' },
  rightShoulder: { transformOrigin: '71% 66%' },
  neck: { transformOrigin: '50% 64%' },
});
