import { DMSans_400Regular } from '@expo-google-fonts/dm-sans/400Regular';
import { DMSans_500Medium } from '@expo-google-fonts/dm-sans/500Medium';
import { DMSans_700Bold } from '@expo-google-fonts/dm-sans/700Bold';
import { Nunito_700Bold } from '@expo-google-fonts/nunito/700Bold';
import { Nunito_800ExtraBold } from '@expo-google-fonts/nunito/800ExtraBold';
import { useFonts } from 'expo-font';
import { router, Stack, usePathname } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef } from 'react';
import { AppState, LogBox, StyleSheet, View } from 'react-native';

import { Notice } from '@/components/ui/Bits';
import { Button } from '@/components/ui/Button';
import { colors, spacing } from '@/constants/theme';
import { FeedbackProvider } from '@/contexts/FeedbackContext';
import { configureNotifications, subscribeToDoseNotifications, syncDoseNotifications } from '@/services/notifications';
import { useCareStore } from '@/stores/careStore';
import { useSessionStore } from '@/stores/sessionStore';

// Expo Go always prints this notice. Only remote push is limited, and this app uses local reminders.
LogBox.ignoreLogs(['expo-notifications', '[expo-notifications]']);

SplashScreen.preventAutoHideAsync().catch(() => undefined);

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_700Bold,
    Nunito_700Bold,
    Nunito_800ExtraBold,
  });
  const bootstrap = useSessionStore((state) => state.bootstrap);
  const ready = fontsLoaded || Boolean(fontError);

  useEffect(() => {
    void bootstrap();
    configureNotifications().catch(() => undefined);
  }, [bootstrap]);

  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => undefined);
  }, [ready]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        syncDoseNotifications(useCareStore.getState().data).catch(() => undefined);
      } else {
        void useCareStore.getState().flush();
      }
    });
    return () => subscription.remove();
  }, []);

  if (!ready) return <View style={styles.root} />;

  return (
    <FeedbackProvider>
      <StatusBar style="dark" />
      <NotificationRouter />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.cream },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="index" options={{ animation: 'fade' }} />
        <Stack.Screen name="(auth)" options={{ animation: 'fade' }} />
        <Stack.Screen name="onboarding" options={{ animation: 'fade', gestureEnabled: false }} />
        <Stack.Screen name="(tabs)" options={{ animation: 'fade', gestureEnabled: false }} />
        <Stack.Screen name="medication/edit" options={{ animation: 'slide_from_bottom' }} />
        <Stack.Screen name="reminder/[key]" options={{ animation: 'slide_from_bottom' }} />
      </Stack>
      <StorageWarning />
    </FeedbackProvider>
  );
}

/** Opens the reminder screen when a dose notification is tapped or arrives in the foreground. */
function NotificationRouter() {
  const status = useSessionStore((state) => state.status);
  const pathname = usePathname();
  const pathRef = useRef(pathname);
  pathRef.current = pathname;

  useEffect(() => {
    if (status !== 'signedIn') return;
    return subscribeToDoseNotifications({
      onOpened: ({ occurrenceKey }) => router.push(`/reminder/${occurrenceKey}`),
      onReceived: ({ kind, occurrenceKey }) => {
        const { autoPlayVoice } = useCareStore.getState().data.settings;
        // Never interrupt someone who is recording a message.
        if (kind === 'dose' && autoPlayVoice && pathRef.current !== '/voice') {
          router.push(`/reminder/${occurrenceKey}`);
        }
      },
    });
  }, [status]);

  return null;
}

function StorageWarning() {
  const storageError = useCareStore((state) => state.storageError);
  const clearStorageError = useCareStore((state) => state.clearStorageError);
  if (!storageError) return null;
  return (
    <View style={styles.warning}>
      <Notice icon="alert-triangle" tone="coral" title="Storage problem" message={storageError}>
        <Button compact variant="secondary" label="Dismiss" onPress={clearStorageError} />
      </Notice>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.cream },
  warning: { position: 'absolute', left: spacing.md, right: spacing.md, bottom: spacing.xxxl * 3 },
});
