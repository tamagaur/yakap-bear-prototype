import { supabase } from '@/lib/supabase';
import type { Referral } from '@/types/models';
import { createId } from '@/utils/ids';

export type ReferralResult =
  | { outcome: 'verified'; referral: Referral }
  | { outcome: 'invalid' }
  | { outcome: 'no_backend' }
  | { outcome: 'offline' };

/** Only the backend can verify a code. Without one, no clinic is ever reported as linked. */
export async function verifyReferralCode(code: string): Promise<ReferralResult> {
  if (!supabase) return { outcome: 'no_backend' };
  const { data, error } = await supabase.rpc('validate_referral_code', { input_code: code.trim().toUpperCase() });
  if (error) return { outcome: 'offline' };
  const match = (Array.isArray(data) ? data[0] : data) as
    | { clinic_name: string; clinician_name: string | null }
    | null
    | undefined;
  if (!match) return { outcome: 'invalid' };
  return {
    outcome: 'verified',
    referral: {
      id: createId(),
      code: code.trim().toUpperCase(),
      status: 'verified',
      clinicName: match.clinic_name,
      clinicianName: match.clinician_name ?? undefined,
      linkedAt: new Date().toISOString(),
    },
  };
}

export function createDemoReferral(): Referral {
  return {
    id: createId(),
    code: 'DEMO-0000',
    status: 'demo',
    clinicName: 'Sample Clinic (demo)',
    clinicianName: 'Sample clinician',
    linkedAt: new Date().toISOString(),
  };
}
