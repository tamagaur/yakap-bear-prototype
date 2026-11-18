import AsyncStorage from '@react-native-async-storage/async-storage';

import { createEmptyData } from '@/constants/defaults';
import type { CareRepository } from '@/repositories/types';
import type { AppData } from '@/types/models';

/** Keeps each account's data under its own key in the app's private storage. */
export class LocalCareRepository implements CareRepository {
  readonly kind = 'local' as const;
  private readonly key: string;

  constructor(namespace: string) {
    this.key = `yakap.care.v1.${namespace}`;
  }

  async load(): Promise<AppData | null> {
    const raw = await AsyncStorage.getItem(this.key);
    if (!raw) return null;
    try {
      const empty = createEmptyData();
      const parsed = JSON.parse(raw) as Partial<AppData>;
      return { ...empty, ...parsed, settings: { ...empty.settings, ...parsed.settings } };
    } catch {
      // Keep the unreadable copy for recovery instead of silently overwriting it.
      await AsyncStorage.setItem(`${this.key}.unreadable`, raw);
      await AsyncStorage.removeItem(this.key);
      throw new Error('Saved care data could not be read.');
    }
  }

  async save(data: AppData): Promise<void> {
    await AsyncStorage.setItem(this.key, JSON.stringify(data));
  }

  async clear(): Promise<void> {
    await AsyncStorage.removeItem(this.key);
  }
}
