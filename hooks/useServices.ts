import NetInfo from '@react-native-community/netinfo';
import { useEffect, useState, useSyncExternalStore } from 'react';

import { voicePlayback } from '@/services/audio/voicePlayback';
import { bearService } from '@/services/bear';

export const useBear = () => useSyncExternalStore(bearService.subscribe, bearService.getSnapshot, bearService.getSnapshot);

export const usePlayback = () =>
  useSyncExternalStore(voicePlayback.subscribe, voicePlayback.getSnapshot, voicePlayback.getSnapshot);

/** False only when the phone reports that it has no connection. */
export function useIsOnline(): boolean {
  const [online, setOnline] = useState(true);
  useEffect(
    () =>
      NetInfo.addEventListener((state) => {
        setOnline(state.isConnected !== false);
      }),
    [],
  );
  return online;
}
