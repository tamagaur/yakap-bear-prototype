/**
 * RFC 4122 shaped identifier for local records. These identify rows and are never
 * used as secrets, so a non-cryptographic random source is sufficient.
 */
export function createId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const random = Math.floor(Math.random() * 16);
    const value = char === 'x' ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}
