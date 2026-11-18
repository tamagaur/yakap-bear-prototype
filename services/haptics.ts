import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

let enabled = true;

export function setHapticsEnabled(value: boolean) {
  enabled = value;
}

const run = (action: () => Promise<void>) => {
  if (!enabled || Platform.OS === 'web') return;
  action().catch(() => undefined);
};

export const haptics = {
  tap: () => run(() => Haptics.selectionAsync()),
  soft: () => run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft)),
  success: () => run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
  warning: () => run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)),
};
