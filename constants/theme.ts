import { Platform, type TextStyle, type ViewStyle } from 'react-native';

/** Brand palette. Values marked "brand" come directly from the Yakap Bear identity. */
export const colors = {
  cream: '#F7F0E5', // brand
  creamDeep: '#EFE5D6',
  card: '#FFFCF7', // brand
  border: '#EDE3D4',
  borderStrong: '#D9CBB7',

  primary: '#327F72', // brand
  primaryDark: '#25635A',
  primarySoft: '#E3EFEA',

  honey: '#E6B337', // brand
  honeyDark: '#8A6410',
  honeySoft: '#FBF0D3',

  brown: '#B98263', // brand
  brownDark: '#7E5238',
  brownSoft: '#F1E4D9',

  coral: '#E8A7A0', // brand
  coralDeep: '#B9483F',
  coralSoft: '#FBE9E6',

  blue: '#4A5E96',
  blueSoft: '#E7EBF5',

  text: '#3F352F', // brand
  textMuted: '#6F6157',
  textOnPrimary: '#FFFCF7',
  overlay: 'rgba(63, 53, 47, 0.42)',
} as const;

export const spacing = { xxs: 4, xs: 8, sm: 12, md: 16, lg: 20, xl: 24, xxl: 32, xxxl: 40 } as const;

export const radii = { sm: 12, md: 16, lg: 22, xl: 28, pill: 999 } as const;

export const fonts = {
  headingBold: 'Nunito_700Bold',
  headingHeavy: 'Nunito_800ExtraBold',
  body: 'DMSans_400Regular',
  bodyMedium: 'DMSans_500Medium',
  bodyBold: 'DMSans_700Bold',
} as const;

export const type = {
  display: { fontFamily: fonts.headingHeavy, fontSize: 32, lineHeight: 39 },
  h1: { fontFamily: fonts.headingBold, fontSize: 27, lineHeight: 34 },
  h2: { fontFamily: fonts.headingBold, fontSize: 22, lineHeight: 28 },
  h3: { fontFamily: fonts.headingBold, fontSize: 19, lineHeight: 25 },
  title: { fontFamily: fonts.bodyBold, fontSize: 16, lineHeight: 22 },
  body: { fontFamily: fonts.body, fontSize: 16, lineHeight: 23 },
  bodyMedium: { fontFamily: fonts.bodyMedium, fontSize: 16, lineHeight: 23 },
  small: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20 },
  smallBold: { fontFamily: fonts.bodyBold, fontSize: 14, lineHeight: 20 },
  caption: { fontFamily: fonts.bodyMedium, fontSize: 13, lineHeight: 18 },
  eyebrow: { fontFamily: fonts.bodyBold, fontSize: 12, lineHeight: 16, letterSpacing: 1, textTransform: 'uppercase' },
  button: { fontFamily: fonts.bodyBold, fontSize: 16.5, lineHeight: 22 },
} satisfies Record<string, TextStyle>;

export type TypeVariant = keyof typeof type;

export const shadows = {
  soft: Platform.select<ViewStyle>({
    ios: { shadowColor: '#7E5238', shadowOpacity: 0.07, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
    android: { elevation: 1.5, shadowColor: '#7E5238' },
    default: { boxShadow: '0 4px 14px rgba(126, 82, 56, 0.07)' },
  }) as ViewStyle,
  raised: Platform.select<ViewStyle>({
    ios: { shadowColor: '#7E5238', shadowOpacity: 0.16, shadowRadius: 20, shadowOffset: { width: 0, height: 10 } },
    android: { elevation: 7, shadowColor: '#7E5238' },
    default: { boxShadow: '0 10px 24px rgba(126, 82, 56, 0.16)' },
  }) as ViewStyle,
} as const;

/** Minimum comfortable touch target, in density-independent pixels. */
export const TOUCH_TARGET = 48;

/** Space kept clear at the bottom of tab screens so content scrolls above the floating bar. */
export const TAB_BAR_CLEARANCE = 112;

export const motion = { fast: 160, base: 240, slow: 380 } as const;
