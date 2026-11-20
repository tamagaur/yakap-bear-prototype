import { displayPhone, formatPhPhone, isCompletePhPhone, isEmptyPhPhone, phLocalDigits } from '@/utils/phone';

describe('Philippine phone formatting', () => {
  it('always keeps the +63 prefix', () => {
    expect(formatPhPhone('')).toBe('+63 ');
    expect(formatPhPhone('+63')).toBe('+63 ');
    expect(isEmptyPhPhone('+63 ')).toBe(true);
  });

  it('drops the leading 0 people are used to typing', () => {
    expect(formatPhPhone('0')).toBe('+63 ');
    expect(formatPhPhone('091234')).toBe('+63 912 34');
    expect(formatPhPhone('09123456789')).toBe('+63 912 345 6789');
  });

  it('formats keystroke by keystroke from the prefilled value', () => {
    let value = formatPhPhone('');
    for (const key of '09123456789') value = formatPhPhone(value + key);
    expect(value).toBe('+63 912 345 6789');
  });

  it('handles deleting back to the prefix', () => {
    expect(formatPhPhone('+63 912 ')).toBe('+63 912');
    expect(formatPhPhone('+63')).toBe('+63 ');
  });

  it('accepts pasted numbers in common shapes', () => {
    expect(formatPhPhone('+639171234567')).toBe('+63 917 123 4567');
    expect(formatPhPhone('9171234567')).toBe('+63 917 123 4567');
    expect(formatPhPhone('0917-123-4567')).toBe('+63 917 123 4567');
  });

  it('stops at 10 local digits', () => {
    expect(phLocalDigits('+63 912 345 67899999')).toBe('9123456789');
  });

  it('only treats full mobile numbers as complete', () => {
    expect(isCompletePhPhone('+63 912 345 6789')).toBe(true);
    expect(isCompletePhPhone('+63 912 345')).toBe(false);
    expect(displayPhone('09175550198')).toBe('+63 917 555 0198');
    expect(displayPhone('911')).toBe('911');
  });
});
