import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';

import { colors } from '@/constants/theme';

export type IconName = ComponentProps<typeof Feather>['name'] | 'paw' | 'stethoscope' | 'signature';

const COMMUNITY_ICONS = {
  paw: 'paw-outline',
  stethoscope: 'stethoscope',
  signature: 'draw-pen',
} as const;

export function Icon({ name, size = 22, color = colors.text }: { name: IconName; size?: number; color?: string }) {
  if (name === 'paw' || name === 'stethoscope' || name === 'signature') {
    return <MaterialCommunityIcons name={COMMUNITY_ICONS[name]} size={size} color={color} />;
  }
  return <Feather name={name} size={size} color={color} />;
}
