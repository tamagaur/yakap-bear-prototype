import type { AppData } from '@/types/models';

/** Storage boundary. Screens and stores never talk to AsyncStorage or Supabase directly. */
export interface CareRepository {
  readonly kind: 'local' | 'cloud';
  load(): Promise<AppData | null>;
  save(data: AppData): Promise<void>;
  clear(): Promise<void>;
}
