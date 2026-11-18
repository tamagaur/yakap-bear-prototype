import type { MedicationInput } from '@/types/models';
import { isValidTime } from '@/utils/schedule';

export type FieldErrors<T extends string> = Partial<Record<T, string>>;

export const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim());

/** Accepts local and international numbers, with common separators. */
export function isValidPhone(value: string): boolean {
  const trimmed = value.trim();
  if (!/^\+?[\d\s().-]+$/.test(trimmed)) return false;
  const digits = trimmed.replace(/\D/g, '');
  return digits.length >= 7 && digits.length <= 15;
}

export type MedicationField = 'name' | 'doseLabel' | 'repeatDays' | 'doses';

export function validateMedication(input: MedicationInput): FieldErrors<MedicationField> {
  const errors: FieldErrors<MedicationField> = {};
  if (!input.name.trim()) errors.name = 'Please enter the medication name.';
  if (!input.doseLabel.trim()) errors.doseLabel = 'Please enter the prescribed quantity, like "2 tablets".';
  if (input.repeatDays.length === 0) errors.repeatDays = 'Choose at least one day.';

  const times = input.doses.map((dose) => dose.time);
  if (times.length === 0) errors.doses = 'Add at least one dose time.';
  else if (times.some((time) => !isValidTime(time))) errors.doses = 'One of the times is not valid.';
  else if (new Set(times).size !== times.length) errors.doses = 'Each dose time can only be listed once.';
  return errors;
}

export function validatePassword(value: string): string | undefined {
  if (value.length < 8) return 'Use at least 8 characters.';
  return undefined;
}
