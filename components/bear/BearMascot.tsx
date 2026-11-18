import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, Ellipse, G, Path } from 'react-native-svg';

import { useReducedMotion } from '@/hooks/useReducedMotion';

const VIEW_BOX = '0 0 200 220';
const ASPECT = 220 / 200;

const fur = {
  main: '#B98263',
  light: '#C4916F',
  deep: '#A06E50',
  belly: '#EBD3B8',
  muzzle: '#F0DCC4',
  inner: '#E4BE9E',
  ink: '#3F2C24',
  blush: '#E8A7A0',
};

export type BearMood = 'idle' | 'happy' | 'sleepy' | 'listening';

interface BearMascotProps {
  size?: number;
  mood?: BearMood;
  /** Gentle up-and-down drift used on the home screen. */
  floating?: boolean;
  /** Waves on arrival and again every few seconds. */
  waving?: boolean;
  /** Change this value to play a small happy hop, such as after a dose is confirmed. */
  celebrateKey?: number | string;
  style?: StyleProp<ViewStyle>;
}

function Layer({ size, children }: { size: number; children: React.ReactNode }) {
  return (
    <Svg width={size} height={size * ASPECT} viewBox={VIEW_BOX} style={StyleSheet.absoluteFill}>
      {children}
    </Svg>
  );
}

function OpenEyes() {
  return (
    <G>
      <Circle cx={78} cy={84} r={7} fill={fur.ink} />
      <Circle cx={122} cy={84} r={7} fill={fur.ink} />
      <Circle cx={80.5} cy={81.5} r={2.3} fill="#FFFFFF" />
      <Circle cx={124.5} cy={81.5} r={2.3} fill="#FFFFFF" />
    </G>
  );
}

function ClosedEyes({ smiling }: { smiling: boolean }) {
  const left = smiling ? 'M70 87 Q78 76 86 87' : 'M70 84 Q78 90 86 84';
  const right = smiling ? 'M114 87 Q122 76 130 87' : 'M114 84 Q122 90 130 84';
  return (
    <G stroke={fur.ink} strokeWidth={4} strokeLinecap="round" fill="none">
      <Path d={left} />
      <Path d={right} />
    </G>
  );
}

export function BearMascot({ size = 160, mood = 'idle', floating, waving, celebrateKey, style }: BearMascotProps) {
  const reducedMotion = useReducedMotion();
  const breathe = useRef(new Animated.Value(0)).current;
  const float = useRef(new Animated.Value(0)).current;
  const wave = useRef(new Animated.Value(0)).current;
  const blink = useRef(new Animated.Value(0)).current;
  const hop = useRef(new Animated.Value(0)).current;
  const heart = useRef(new Animated.Value(0)).current;
  const firstCelebrate = useRef(true);

  useEffect(() => {
    if (reducedMotion) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breathe, { toValue: 1, duration: 1900, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(breathe, { toValue: 0, duration: 1900, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [breathe, reducedMotion]);

  useEffect(() => {
    if (reducedMotion || !floating) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(float, { toValue: 1, duration: 2400, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(float, { toValue: 0, duration: 2400, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [float, floating, reducedMotion]);

  useEffect(() => {
    if (reducedMotion || mood === 'sleepy') return;
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      timer = setTimeout(() => {
        Animated.sequence([
          Animated.timing(blink, { toValue: 1, duration: 80, useNativeDriver: true }),
          Animated.timing(blink, { toValue: 0, duration: 120, useNativeDriver: true }),
        ]).start(schedule);
      }, 2600 + Math.random() * 3000);
    };
    schedule();
    return () => clearTimeout(timer);
  }, [blink, mood, reducedMotion]);

  useEffect(() => {
    if (reducedMotion || !waving) return;
    const swing = (toValue: number) =>
      Animated.timing(wave, { toValue, duration: 190, easing: Easing.inOut(Easing.quad), useNativeDriver: true });
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(500),
        swing(1),
        swing(0.45),
        swing(1),
        swing(0.45),
        swing(1),
        swing(0),
        Animated.delay(5200),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [reducedMotion, wave, waving]);

  useEffect(() => {
    if (celebrateKey === undefined) return;
    if (firstCelebrate.current) {
      firstCelebrate.current = false;
      return;
    }
    heart.setValue(0);
    Animated.parallel([
      Animated.timing(heart, { toValue: 1, duration: 1100, useNativeDriver: true }),
      reducedMotion
        ? Animated.delay(0)
        : Animated.sequence([
            Animated.timing(hop, { toValue: 1, duration: 170, easing: Easing.out(Easing.quad), useNativeDriver: true }),
            Animated.timing(hop, { toValue: 0, duration: 230, easing: Easing.bounce, useNativeDriver: true }),
          ]),
    ]).start();
  }, [celebrateKey, heart, hop, reducedMotion]);

  const height = size * ASPECT;
  const bodyScale = breathe.interpolate({ inputRange: [0, 1], outputRange: [1, 1.022] });
  const headLift = breathe.interpolate({ inputRange: [0, 1], outputRange: [0, -size * 0.008] });
  const floatY = float.interpolate({ inputRange: [0, 1], outputRange: [0, -size * 0.035] });
  const hopY = hop.interpolate({ inputRange: [0, 1], outputRange: [0, -size * 0.08] });
  const armRotate = wave.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '-118deg'] });
  const openOpacity = blink.interpolate({ inputRange: [0, 1], outputRange: [1, 0] });
  const heartOpacity = heart.interpolate({ inputRange: [0, 0.15, 0.7, 1], outputRange: [0, 1, 1, 0] });
  const heartY = heart.interpolate({ inputRange: [0, 1], outputRange: [size * 0.08, -size * 0.12] });

  const eyesAlwaysClosed = mood === 'happy' || mood === 'sleepy';
  const mouth =
    mood === 'happy' ? (
      <Path d="M86 112 Q100 134 114 112 Z" fill={fur.ink} stroke={fur.ink} strokeWidth={3} strokeLinejoin="round" />
    ) : (
      <Path d="M87 113 Q100 126 113 113" stroke={fur.ink} strokeWidth={4} strokeLinecap="round" fill="none" />
    );

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel="Yakap Bear, a friendly brown teddy bear"
      style={[{ width: size, height }, style]}
    >
      <Layer size={size}>
        <Ellipse cx={100} cy={210} rx={62} ry={8} fill="#7E5238" opacity={0.14} />
      </Layer>

      <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ translateY: floatY }, { translateY: hopY }] }]}>
        <Animated.View style={[StyleSheet.absoluteFill, styles.bodyOrigin, { transform: [{ scaleY: bodyScale }] }]}>
          <Layer size={size}>
            <Ellipse cx={64} cy={197} rx={24} ry={14} fill={fur.deep} />
            <Ellipse cx={136} cy={197} rx={24} ry={14} fill={fur.deep} />
            <Ellipse cx={64} cy={198} rx={12} ry={7} fill={fur.inner} />
            <Ellipse cx={136} cy={198} rx={12} ry={7} fill={fur.inner} />
            <Ellipse cx={100} cy={152} rx={55} ry={54} fill={fur.main} />
            <Ellipse cx={100} cy={163} rx={35} ry={37} fill={fur.belly} />
          </Layer>
        </Animated.View>

        <Layer size={size}>
          <G rotation={14} originX={44} originY={150}>
            <Ellipse cx={44} cy={150} rx={15} ry={29} fill={fur.deep} />
          </G>
        </Layer>

        <Animated.View style={[StyleSheet.absoluteFill, styles.armOrigin, { transform: [{ rotate: armRotate }] }]}>
          <Layer size={size}>
            <G rotation={-14} originX={156} originY={150}>
              <Ellipse cx={156} cy={150} rx={15} ry={29} fill={fur.deep} />
            </G>
          </Layer>
        </Animated.View>

        <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ translateY: headLift }] }]}>
          <Layer size={size}>
            <Circle cx={50} cy={46} r={25} fill={fur.main} />
            <Circle cx={150} cy={46} r={25} fill={fur.main} />
            <Circle cx={50} cy={47} r={14} fill={fur.inner} />
            <Circle cx={150} cy={47} r={14} fill={fur.inner} />
            <Ellipse cx={100} cy={80} rx={66} ry={60} fill={fur.main} />
            <Ellipse cx={100} cy={52} rx={40} ry={22} fill={fur.light} opacity={0.65} />
            <Ellipse cx={100} cy={100} rx={40} ry={32} fill={fur.muzzle} />
            <Circle cx={62} cy={103} r={9} fill={fur.blush} opacity={0.5} />
            <Circle cx={138} cy={103} r={9} fill={fur.blush} opacity={0.5} />
            <Ellipse cx={100} cy={100} rx={9} ry={7} fill={fur.ink} />
            <Path d="M100 106 L100 113" stroke={fur.ink} strokeWidth={3.5} strokeLinecap="round" />
            {mouth}
          </Layer>
          {eyesAlwaysClosed ? (
            <Layer size={size}>
              <ClosedEyes smiling={mood === 'happy'} />
            </Layer>
          ) : (
            <>
              <Animated.View style={[StyleSheet.absoluteFill, { opacity: openOpacity }]}>
                <Layer size={size}>
                  <OpenEyes />
                </Layer>
              </Animated.View>
              <Animated.View style={[StyleSheet.absoluteFill, { opacity: blink }]}>
                <Layer size={size}>
                  <ClosedEyes smiling={false} />
                </Layer>
              </Animated.View>
            </>
          )}
        </Animated.View>

        {celebrateKey !== undefined ? (
          <Animated.View
            pointerEvents="none"
            style={[StyleSheet.absoluteFill, { opacity: heartOpacity, transform: [{ translateY: heartY }] }]}
          >
            <Layer size={size}>
              <Path
                d="M166 40 C166 30 180 28 182 40 C184 28 198 30 198 40 C198 52 182 60 182 60 C182 60 166 52 166 40 Z"
                fill={fur.blush}
              />
              <Path
                d="M4 62 C4 55 14 53 15 62 C16 53 26 55 26 62 C26 71 15 77 15 77 C15 77 4 71 4 62 Z"
                fill="#E6B337"
              />
            </Layer>
          </Animated.View>
        ) : null}
      </Animated.View>
    </View>
  );
}

/** A small, still bear face for list rows and avatars. */
export function BearFace({ size = 44 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="16 14 168 134">
      <Circle cx={50} cy={46} r={25} fill={fur.main} />
      <Circle cx={150} cy={46} r={25} fill={fur.main} />
      <Circle cx={50} cy={47} r={14} fill={fur.inner} />
      <Circle cx={150} cy={47} r={14} fill={fur.inner} />
      <Ellipse cx={100} cy={80} rx={66} ry={60} fill={fur.main} />
      <Ellipse cx={100} cy={100} rx={40} ry={32} fill={fur.muzzle} />
      <OpenEyes />
      <Ellipse cx={100} cy={100} rx={9} ry={7} fill={fur.ink} />
      <Path d="M87 113 Q100 126 113 113" stroke={fur.ink} strokeWidth={4} strokeLinecap="round" fill="none" />
    </Svg>
  );
}

const styles = StyleSheet.create({
  bodyOrigin: { transformOrigin: '50% 92%' },
  armOrigin: { transformOrigin: '72% 56%' },
});
