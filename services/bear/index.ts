import { DemoBearService } from '@/services/bear/DemoBearService';

export { DEMO_START_BATTERY } from '@/services/bear/DemoBearService';
export type { BearService, BearSnapshot } from '@/services/bear/types';

/** Expo Go always uses the simulated bear. Swap this for HardwareBearService in a future build. */
export const bearService = new DemoBearService();
