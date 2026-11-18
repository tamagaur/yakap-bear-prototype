import { ActivityIndicator, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { Icon, type IconName } from '@/components/ui/Icon';
import { PressableScale } from '@/components/ui/PressableScale';
import { colors, radii, shadows, spacing, TOUCH_TARGET } from '@/constants/theme';

type ButtonVariant = 'primary' | 'teal' | 'secondary' | 'ghost' | 'danger';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  icon?: IconName;
  iconRight?: IconName;
  loading?: boolean;
  disabled?: boolean;
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
  containerStyle?: StyleProp<ViewStyle>;
  accessibilityHint?: string;
}

const palette: Record<ButtonVariant, { background: string; foreground: string; border?: string }> = {
  primary: { background: colors.honey, foreground: colors.text },
  teal: { background: colors.primary, foreground: colors.textOnPrimary },
  secondary: { background: colors.card, foreground: colors.text, border: colors.border },
  ghost: { background: 'transparent', foreground: colors.primaryDark },
  danger: { background: colors.coralSoft, foreground: colors.coralDeep },
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  icon,
  iconRight,
  loading,
  disabled,
  compact,
  style,
  containerStyle,
  accessibilityHint,
}: ButtonProps) {
  const tone = palette[variant];
  const isDisabled = disabled || loading;

  return (
    <PressableScale
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: Boolean(isDisabled), busy: Boolean(loading) }}
      disabled={isDisabled}
      onPress={onPress}
      containerStyle={containerStyle}
      style={[
        styles.base,
        compact && styles.compact,
        { backgroundColor: tone.background },
        tone.border ? { borderColor: tone.border, borderWidth: 1 } : null,
        (variant === 'primary' || variant === 'teal') && !isDisabled ? shadows.soft : null,
        isDisabled && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={tone.foreground} />
      ) : (
        <View style={styles.row}>
          {icon ? <Icon name={icon} size={compact ? 17 : 19} color={tone.foreground} /> : null}
          <AppText variant={compact ? 'smallBold' : 'button'} color={tone.foreground} style={styles.label}>
            {label}
          </AppText>
          {iconRight ? <Icon name={iconRight} size={compact ? 17 : 19} color={tone.foreground} /> : null}
        </View>
      )}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 54,
    borderRadius: radii.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compact: { minHeight: TOUCH_TARGET - 4, paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs },
  label: { flexShrink: 1, textAlign: 'center' },
  disabled: { opacity: 0.5 },
});
