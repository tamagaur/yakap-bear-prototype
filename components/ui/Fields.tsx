import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Switch, TextInput, View, type TextInputProps } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Icon } from '@/components/ui/Icon';
import { PressableScale } from '@/components/ui/PressableScale';
import { colors, fonts, radii, spacing, TOUCH_TARGET } from '@/constants/theme';
import { haptics } from '@/services/haptics';
import { formatPhPhone, PH_PREFIX } from '@/utils/phone';

function FieldShell({
  label,
  error,
  hint,
  children,
}: {
  label: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <View style={styles.field}>
      <AppText variant="smallBold">{label}</AppText>
      {children}
      {error ? (
        <View style={styles.errorRow} accessibilityLiveRegion="polite">
          <Icon name="alert-circle" size={15} color={colors.coralDeep} />
          <AppText variant="caption" color={colors.coralDeep} style={styles.flex}>
            {error}
          </AppText>
        </View>
      ) : hint ? (
        <AppText variant="caption" color={colors.textMuted}>
          {hint}
        </AppText>
      ) : null}
    </View>
  );
}

interface TextFieldProps extends TextInputProps {
  label: string;
  error?: string;
  hint?: string;
  secure?: boolean;
}

export function TextField({ label, error, hint, secure, style, onFocus, onBlur, multiline, ...rest }: TextFieldProps) {
  const [focused, setFocused] = useState(false);
  const [revealed, setRevealed] = useState(false);

  return (
    <FieldShell label={label} error={error} hint={hint}>
      <View style={[styles.inputWrap, focused && styles.focused, Boolean(error) && styles.invalid]}>
        <TextInput
          accessibilityLabel={label}
          placeholderTextColor={colors.textMuted}
          secureTextEntry={secure && !revealed}
          multiline={multiline}
          maxFontSizeMultiplier={1.5}
          onFocus={(event) => {
            setFocused(true);
            onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            onBlur?.(event);
          }}
          style={[styles.input, multiline && styles.multiline, style]}
          {...rest}
        />
        {secure ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={revealed ? 'Hide password' : 'Show password'}
            onPress={() => setRevealed((value) => !value)}
            style={styles.reveal}
          >
            <Icon name={revealed ? 'eye-off' : 'eye'} size={20} color={colors.textMuted} />
          </Pressable>
        ) : null}
      </View>
    </FieldShell>
  );
}

/** Philippine mobile number input. "+63" is always there and the number formats as you type. */
export function PhoneField({
  label,
  value,
  onChangeText,
  error,
  hint,
}: {
  label: string;
  value: string;
  onChangeText: (formatted: string) => void;
  error?: string;
  hint?: string;
}) {
  return (
    <TextField
      label={label}
      value={value ? formatPhPhone(value) : PH_PREFIX}
      onChangeText={(text) => onChangeText(formatPhPhone(text))}
      error={error}
      hint={hint}
      keyboardType="phone-pad"
      autoComplete="tel"
      textContentType="telephoneNumber"
      placeholder="+63 912 345 6789"
    />
  );
}

export interface SelectOption {
  value: string;
  label: string;
  description?: string;
}

interface SelectFieldProps {
  label: string;
  value: string | undefined;
  options: SelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  error?: string;
  hint?: string;
}

export function SelectField({ label, value, options, onChange, placeholder = 'Choose one', error, hint }: SelectFieldProps) {
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.value === value);

  return (
    <FieldShell label={label} error={error} hint={hint}>
      <PressableScale
        accessibilityLabel={`${label}: ${selected?.label ?? placeholder}`}
        onPress={() => setOpen(true)}
        pressedScale={0.99}
        style={[styles.inputWrap, styles.select, Boolean(error) && styles.invalid]}
      >
        <AppText variant="bodyMedium" color={selected ? colors.text : colors.textMuted} style={styles.flex} numberOfLines={1}>
          {selected?.label ?? placeholder}
        </AppText>
        <Icon name="chevron-down" size={20} color={colors.textMuted} />
      </PressableScale>
      <BottomSheet visible={open} onClose={() => setOpen(false)} title={label}>
        <View style={styles.optionList}>
          {options.map((option) => {
            const active = option.value === value;
            return (
              <PressableScale
                key={option.value}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
                accessibilityLabel={option.label}
                onPress={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
                pressedScale={0.99}
                style={[styles.option, active && styles.optionActive]}
              >
                <View style={styles.flex}>
                  <AppText variant="bodyMedium">{option.label}</AppText>
                  {option.description ? (
                    <AppText variant="caption" color={colors.textMuted}>
                      {option.description}
                    </AppText>
                  ) : null}
                </View>
                {active ? <Icon name="check" size={20} color={colors.primary} /> : null}
              </PressableScale>
            );
          })}
        </View>
      </BottomSheet>
    </FieldShell>
  );
}

export function Checkbox({
  label,
  description,
  checked,
  onChange,
  error,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  error?: string;
}) {
  return (
    <View style={styles.field}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked }}
        accessibilityLabel={label}
        onPress={() => {
          haptics.tap();
          onChange(!checked);
        }}
        style={styles.checkRow}
      >
        <View style={[styles.checkbox, checked && styles.checkboxOn, Boolean(error) && styles.invalid]}>
          {checked ? <Icon name="check" size={17} color={colors.textOnPrimary} /> : null}
        </View>
        <View style={styles.flex}>
          <AppText variant="bodyMedium">{label}</AppText>
          {description ? (
            <AppText variant="small" color={colors.textMuted}>
              {description}
            </AppText>
          ) : null}
        </View>
      </Pressable>
      {error ? (
        <AppText variant="caption" color={colors.coralDeep}>
          {error}
        </AppText>
      ) : null}
    </View>
  );
}

export function ToggleRow({
  label,
  description,
  value,
  onChange,
  disabled,
}: {
  label: string;
  description?: string;
  value: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <View style={styles.toggleRow}>
      <View style={styles.flex}>
        <AppText variant="title">{label}</AppText>
        {description ? (
          <AppText variant="small" color={colors.textMuted}>
            {description}
          </AppText>
        ) : null}
      </View>
      <Switch
        accessibilityLabel={label}
        value={value}
        disabled={disabled}
        onValueChange={(next) => {
          haptics.tap();
          onChange(next);
        }}
        trackColor={{ false: colors.borderStrong, true: colors.primary }}
        thumbColor={colors.card}
        ios_backgroundColor={colors.borderStrong}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  field: { gap: 6 },
  errorRow: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radii.md,
    minHeight: 54,
  },
  focused: { borderColor: colors.primary },
  invalid: { borderColor: colors.coralDeep },
  input: {
    flex: 1,
    fontFamily: fonts.bodyMedium,
    fontSize: 16,
    color: colors.text,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: 52,
  },
  multiline: { minHeight: 92, textAlignVertical: 'top' },
  reveal: { width: TOUCH_TARGET, height: TOUCH_TARGET, alignItems: 'center', justifyContent: 'center' },
  select: { paddingHorizontal: spacing.md, gap: spacing.xs },
  optionList: { gap: spacing.xs },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 54,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.xs,
  },
  optionActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  checkRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start', minHeight: TOUCH_TARGET, paddingVertical: 4 },
  checkbox: {
    width: 26,
    height: 26,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
    marginTop: 1,
  },
  checkboxOn: { backgroundColor: colors.primary },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: TOUCH_TARGET },
});
