import { Text, type TextProps, type TextStyle } from 'react-native';

import { colors, type as typeScale, type TypeVariant } from '@/constants/theme';

export interface AppTextProps extends TextProps {
  variant?: TypeVariant;
  color?: string;
  align?: TextStyle['textAlign'];
}

export function AppText({ variant = 'body', color = colors.text, align, style, ...rest }: AppTextProps) {
  return (
    <Text
      maxFontSizeMultiplier={1.5}
      {...rest}
      style={[typeScale[variant], { color, textAlign: align }, style]}
    />
  );
}
