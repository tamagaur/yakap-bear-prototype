import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, Easing, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { BearMascot, type BearMood } from '@/components/bear/BearMascot';
import { AppText } from '@/components/ui/AppText';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Button } from '@/components/ui/Button';
import { Icon, type IconName } from '@/components/ui/Icon';
import { PressableScale } from '@/components/ui/PressableScale';
import { colors, motion, radii, spacing, TOUCH_TARGET } from '@/constants/theme';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import type { DoseStatus } from '@/types/models';

export type Tone = 'teal' | 'honey' | 'coral' | 'brown' | 'blue' | 'neutral';

const toneColors: Record<Tone, { background: string; foreground: string }> = {
  teal: { background: colors.primarySoft, foreground: colors.primaryDark },
  honey: { background: colors.honeySoft, foreground: colors.honeyDark },
  coral: { background: colors.coralSoft, foreground: colors.coralDeep },
  brown: { background: colors.brownSoft, foreground: colors.brownDark },
  blue: { background: colors.blueSoft, foreground: colors.blue },
  neutral: { background: colors.creamDeep, foreground: colors.textMuted },
};

export function IconBadge({ icon, tone = 'teal', size = 44 }: { icon: IconName; tone?: Tone; size?: number }) {
  const palette = toneColors[tone];
  return (
    <View style={[styles.iconBadge, { width: size, height: size, backgroundColor: palette.background }]}>
      <Icon name={icon} size={size * 0.5} color={palette.foreground} />
    </View>
  );
}

export function Tag({ label, tone = 'neutral', icon }: { label: string; tone?: Tone; icon?: IconName }) {
  const palette = toneColors[tone];
  return (
    <View style={[styles.tag, { backgroundColor: palette.background }]}>
      {icon ? <Icon name={icon} size={13} color={palette.foreground} /> : null}
      <AppText variant="caption" color={palette.foreground}>
        {label}
      </AppText>
    </View>
  );
}

/** Marks anything simulated, so demo values are never mistaken for real ones. */
export function DemoTag({ label = 'Demo' }: { label?: string }) {
  return <Tag label={label} tone="honey" icon="info" />;
}

export const STATUS_META: Record<DoseStatus, { label: string; tone: Tone; icon: IconName; color: string }> = {
  upcoming: { label: 'Upcoming', tone: 'blue', icon: 'clock', color: colors.blue },
  taken: { label: 'Taken', tone: 'teal', icon: 'check-circle', color: colors.primary },
  late: { label: 'Late', tone: 'honey', icon: 'alert-triangle', color: colors.honeyDark },
  missed: { label: 'Unconfirmed', tone: 'coral', icon: 'x-circle', color: colors.coralDeep },
  skipped: { label: 'Skipped', tone: 'neutral', icon: 'minus-circle', color: colors.textMuted },
  away: { label: 'Away', tone: 'brown', icon: 'map-pin', color: colors.brownDark },
};

export function StatusPill({ status, confirmedLate }: { status: DoseStatus; confirmedLate?: boolean }) {
  const meta = STATUS_META[status];
  return <Tag label={confirmedLate ? 'Taken late' : meta.label} tone={meta.tone} icon={meta.icon} />;
}

export function ProgressBar({ value, color = colors.primary, label }: { value: number; color?: string; label?: string }) {
  const progress = useRef(new Animated.Value(0)).current;
  const reducedMotion = useReducedMotion();
  const clamped = Math.max(0, Math.min(1, value));

  useEffect(() => {
    Animated.timing(progress, {
      toValue: clamped,
      duration: reducedMotion ? 0 : motion.slow,
      useNativeDriver: false,
    }).start();
  }, [clamped, progress, reducedMotion]);

  const width = progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped * 100) }}
      style={styles.progressTrack}
    >
      <Animated.View style={[styles.progressFill, { width, backgroundColor: color }]} />
    </View>
  );
}

export function SectionHeader({
  title,
  action,
  onAction,
}: {
  title: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.sectionHeader}>
      <AppText variant="title" accessibilityRole="header" style={[styles.flex, styles.sectionTitle]}>
        {title}
      </AppText>
      {action && onAction ? (
        <PressableScale accessibilityRole="link" accessibilityLabel={action} onPress={onAction} hitSlop={10}>
          <AppText variant="smallBold" color={colors.primaryDark}>
            {action}
          </AppText>
        </PressableScale>
      ) : null}
    </View>
  );
}

export function ListRow({
  icon,
  iconTone,
  leading,
  title,
  subtitle,
  right,
  onPress,
  showChevron = true,
}: {
  icon?: IconName;
  iconTone?: Tone;
  leading?: ReactNode;
  title: string;
  subtitle?: string;
  right?: ReactNode;
  onPress?: () => void;
  showChevron?: boolean;
}) {
  const content = (
    <>
      {leading ?? (icon ? <IconBadge icon={icon} tone={iconTone} size={40} /> : null)}
      <View style={styles.flex}>
        <AppText variant="title">{title}</AppText>
        {subtitle ? (
          <AppText variant="small" color={colors.textMuted}>
            {subtitle}
          </AppText>
        ) : null}
      </View>
      {right}
      {onPress && showChevron ? <Icon name="chevron-right" size={20} color={colors.textMuted} /> : null}
    </>
  );
  if (!onPress) return <View style={styles.listRow}>{content}</View>;
  return (
    <PressableScale
      accessibilityLabel={subtitle ? `${title}. ${subtitle}` : title}
      onPress={onPress}
      pressedScale={0.985}
      style={styles.listRow}
    >
      {content}
    </PressableScale>
  );
}

export const Divider = () => <View style={styles.divider} />;

export function EmptyState({
  title,
  message,
  actionLabel,
  onAction,
  mood = 'comfort',
  size = 110,
}: {
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
  mood?: BearMood;
  size?: number;
}) {
  return (
    <View style={styles.empty}>
      <BearMascot size={size} mood={mood} />
      <AppText variant="h3" align="center">
        {title}
      </AppText>
      {message ? (
        <AppText variant="small" color={colors.textMuted} align="center" style={styles.emptyMessage}>
          {message}
        </AppText>
      ) : null}
      {actionLabel && onAction ? (
        <Button label={actionLabel} icon="plus" onPress={onAction} compact containerStyle={styles.emptyAction} />
      ) : null}
    </View>
  );
}

/** A compact status label with a colored dot, used instead of long banners. */
export function StatusChip({
  label,
  tone = 'teal',
  icon,
  onPress,
}: {
  label: string;
  tone?: Tone;
  icon?: IconName;
  onPress?: () => void;
}) {
  const palette = toneColors[tone];
  const content = (
    <>
      {icon ? (
        <Icon name={icon} size={13} color={palette.foreground} />
      ) : (
        <View style={[styles.chipDot, { backgroundColor: palette.foreground }]} />
      )}
      <AppText variant="caption" color={palette.foreground} numberOfLines={1}>
        {label}
      </AppText>
      {onPress ? <Icon name="info" size={13} color={palette.foreground} /> : null}
    </>
  );
  if (!onPress) return <View style={[styles.chip, { backgroundColor: palette.background }]}>{content}</View>;
  return (
    <PressableScale
      accessibilityLabel={`${label}. More information`}
      onPress={onPress}
      hitSlop={8}
      style={[styles.chip, { backgroundColor: palette.background }]}
    >
      {content}
    </PressableScale>
  );
}

/** Keeps important details one tap away instead of on screen all the time. */
export function InfoLink({
  label,
  title,
  children,
  tone = 'honey',
  icon,
}: {
  label: string;
  title: string;
  children: ReactNode;
  tone?: Tone;
  icon?: IconName;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <StatusChip label={label} tone={tone} icon={icon} onPress={() => setOpen(true)} />
      <BottomSheet visible={open} onClose={() => setOpen(false)} title={title}>
        {children}
      </BottomSheet>
    </>
  );
}

/** One row in an info sheet: an icon and a short line of text. */
export function InfoPoint({ icon, text, tone = 'teal' }: { icon: IconName; text: string; tone?: Tone }) {
  return (
    <View style={styles.infoPoint}>
      <IconBadge icon={icon} tone={tone} size={34} />
      <AppText variant="small" style={styles.flex}>
        {text}
      </AppText>
    </View>
  );
}

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/** Circular progress with a label in the middle. */
export function ProgressRing({
  value,
  size = 72,
  stroke = 8,
  color = colors.primary,
  track = colors.creamDeep,
  children,
  label,
}: {
  value: number;
  size?: number;
  stroke?: number;
  color?: string;
  track?: string;
  children?: ReactNode;
  label?: string;
}) {
  const reducedMotion = useReducedMotion();
  const clamped = Math.max(0, Math.min(1, value));
  const progress = useRef(new Animated.Value(0)).current;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;

  useEffect(() => {
    const animation = Animated.timing(progress, {
      toValue: clamped,
      duration: reducedMotion ? 0 : 700,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    });
    animation.start();
    return () => animation.stop();
  }, [clamped, progress, reducedMotion]);

  const dashOffset = progress.interpolate({ inputRange: [0, 1], outputRange: [circumference, 0] });

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped * 100) }}
      style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}
    >
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle cx={size / 2} cy={size / 2} r={radius} stroke={track} strokeWidth={stroke} fill="none" />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={dashOffset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      {children}
    </View>
  );
}

export function Notice({
  icon = 'info',
  tone = 'teal',
  title,
  message,
  style,
  children,
}: {
  icon?: IconName;
  tone?: Tone;
  title?: string;
  message: string;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
}) {
  const palette = toneColors[tone];
  return (
    <View style={[styles.notice, { backgroundColor: palette.background }, style]}>
      <Icon name={icon} size={19} color={palette.foreground} />
      <View style={styles.noticeBody}>
        {title ? (
          <AppText variant="smallBold" color={palette.foreground}>
            {title}
          </AppText>
        ) : null}
        <AppText variant="small" color={colors.text}>
          {message}
        </AppText>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  iconBadge: { borderRadius: radii.pill, alignItems: 'center', justifyContent: 'center' },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: radii.pill,
  },
  progressTrack: { height: 10, borderRadius: 5, backgroundColor: colors.creamDeep, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 5 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm },
  sectionTitle: { fontSize: 17 },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: TOUCH_TARGET + 12,
    paddingVertical: spacing.xs,
  },
  divider: { height: 1, backgroundColor: colors.border },
  empty: { alignItems: 'center', gap: spacing.xs, paddingVertical: spacing.lg, paddingHorizontal: spacing.md },
  emptyMessage: { maxWidth: 280 },
  emptyAction: { marginTop: spacing.xs },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.pill,
  },
  chipDot: { width: 7, height: 7, borderRadius: 4 },
  infoPoint: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  notice: { flexDirection: 'row', gap: spacing.xs, padding: spacing.sm, borderRadius: radii.md },
  noticeBody: { flex: 1, gap: 2 },
});
