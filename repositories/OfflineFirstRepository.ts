import { LocalCareRepository } from '@/repositories/LocalCareRepository';
import type { CareRepository } from '@/repositories/types';
import type { AppData } from '@/types/models';

/** Reads the cloud when reachable, always keeps a local copy, and retries sync on the next save. */
export class OfflineFirstRepository implements CareRepository {
  readonly kind = 'cloud' as const;

  constructor(
    private readonly local: LocalCareRepository,
    private readonly cloud: CareRepository,
    private readonly onSyncError: (error: unknown) => void,
  ) {}

  async load(): Promise<AppData | null> {
    try {
      const remote = await this.cloud.load();
      if (remote) {
        await this.local.save(remote);
        return remote;
      }
    } catch (error) {
      this.onSyncError(error);
    }
    return this.local.load();
  }

  async save(data: AppData): Promise<void> {
    await this.local.save(data);
    try {
      await this.cloud.save(data);
    } catch (error) {
      this.onSyncError(error);
    }
  }

  async clear(): Promise<void> {
    await this.local.clear();
    await this.cloud.clear();
  }
}
