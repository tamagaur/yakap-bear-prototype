/**
 * Philippine mobile numbers, always shown as "+63 9xx xxx xxxx".
 * People can type them however they're used to ("0912…", "912…", "+63 912…").
 */

export const PH_PREFIX = '+63 ';
const LOCAL_LENGTH = 10;

/** The 10 local digits after +63, with any country code or leading 0 removed. */
export function phLocalDigits(value: string): string {
  let digits = value.replace(/\D/g, '');
  if (digits.startsWith('63')) digits = digits.slice(2);
  digits = digits.replace(/^0+/, '');
  return digits.slice(0, LOCAL_LENGTH);
}

/** Formats as the person types: "+63 912 3", then "+63 912 345 6789". Never drops the +63. */
export function formatPhPhone(value: string): string {
  const digits = phLocalDigits(value);
  const groups = [digits.slice(0, 3), digits.slice(3, 6), digits.slice(6, 10)].filter(Boolean);
  return groups.length > 0 ? `+63 ${groups.join(' ')}` : PH_PREFIX;
}

/** True for a full mobile number: 10 digits starting with 9. */
export const isCompletePhPhone = (value: string) => /^9\d{9}$/.test(phLocalDigits(value));

/** True when nothing beyond the +63 prefix has been typed. */
export const isEmptyPhPhone = (value: string) => phLocalDigits(value).length === 0;

/** For lists: shows a full PH mobile in the standard format, and anything else unchanged. */
export function displayPhone(value: string): string {
  return isCompletePhPhone(value) ? formatPhPhone(value) : value;
}
