import * as Notifications from 'expo-notifications';
import { Linking, Platform } from 'react-native';

import type { AppData } from '@/types/models';
import { planNotifications, planSignature } from '@/utils/notificationPlan';

const CHANNEL_ID = 'dose-reminders';

export type NotificationPermission = 'granted' | 'denied' | 'undetermined' | 'unsupported';

export interface NotificationSyncResult {
  permission: NotificationPermission;
  scheduled: number;
  lastReminderAt: Date | null;
}

export interface DoseNotificationData {
  kind: 'dose' | 'follow_up';
  occurrenceKey: string;
}

const isSupported = Platform.OS !== 'web';
let lastSignature: string | null = null;
let queue: Promise<unknown> = Promise.resolve();

export async function configureNotifications() {
  if (!isSupported) return;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'Medication reminders',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 200, 120, 200],
      lightColor: '#327F72',
    });
  }
}

export async function getNotificationPermission(): Promise<NotificationPermission> {
  if (!isSupported) return 'unsupported';
  const { status } = await Notifications.getPermissionsAsync();
  return status;
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!isSupported) return 'unsupported';
  const { status } = await Notifications.requestPermissionsAsync();
  return status;
}

export const openDeviceSettings = () => Linking.openSettings();

async function applyPlan(data: AppData, force: boolean): Promise<NotificationSyncResult> {
  const permission = await getNotificationPermission();
  if (permission !== 'granted') return { permission, scheduled: 0, lastReminderAt: null };

  const plan = planNotifications(data, new Date());
  const lastReminderAt = plan.at(-1)?.at ?? null;
  const signature = planSignature(plan);
  if (!force && signature === lastSignature) {
    return { permission, scheduled: plan.length, lastReminderAt };
  }

  await Notifications.cancelAllScheduledNotificationsAsync();
  for (const item of plan) {
    const payload: DoseNotificationData = { kind: item.kind, occurrenceKey: item.occurrenceKey };
    await Notifications.scheduleNotificationAsync({
      content: { title: item.title, body: item.body, sound: true, data: { ...payload } },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: item.at,
        channelId: CHANNEL_ID,
      },
    });
  }
  lastSignature = signature;
  return { permission, scheduled: plan.length, lastReminderAt };
}

/** Rebuilds pending reminders. Calls run one at a time so overlapping edits cannot interleave. */
export function syncDoseNotifications(data: AppData, force = false): Promise<NotificationSyncResult> {
  const run = queue.then(() => applyPlan(data, force));
  queue = run.catch(() => undefined);
  return run;
}

/** Sends one harmless notification shortly, so a caregiver can check that reminders work. */
export async function sendTestNotification(): Promise<NotificationPermission> {
  const permission = await getNotificationPermission();
  if (permission !== 'granted') return permission;
  await Notifications.scheduleNotificationAsync({
    content: { title: 'Yakap Bear test', body: 'Reminders are working on this phone.', sound: true },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 5, channelId: CHANNEL_ID },
  });
  return permission;
}

export async function cancelAllDoseNotifications() {
  if (!isSupported) return;
  lastSignature = null;
  await Notifications.cancelAllScheduledNotificationsAsync();
}

function readPayload(notification: Notifications.Notification): DoseNotificationData | null {
  const data = notification.request.content.data as Partial<DoseNotificationData> | undefined;
  if (!data?.occurrenceKey || !data.kind) return null;
  return { kind: data.kind, occurrenceKey: data.occurrenceKey };
}

/** Subscribes to reminders being tapped or arriving while the app is open. */
export function subscribeToDoseNotifications(handlers: {
  onOpened: (payload: DoseNotificationData) => void;
  onReceived: (payload: DoseNotificationData) => void;
}): () => void {
  if (!isSupported) return () => undefined;

  const opened = Notifications.addNotificationResponseReceivedListener((response) => {
    const payload = readPayload(response.notification);
    if (payload) handlers.onOpened(payload);
  });
  const received = Notifications.addNotificationReceivedListener((notification) => {
    const payload = readPayload(notification);
    if (payload) handlers.onReceived(payload);
  });

  Notifications.getLastNotificationResponseAsync()
    .then((response) => {
      const payload = response ? readPayload(response.notification) : null;
      if (payload) {
        handlers.onOpened(payload);
        return Notifications.clearLastNotificationResponseAsync();
      }
      return undefined;
    })
    .catch(() => undefined);

  return () => {
    opened.remove();
    received.remove();
  };
}
