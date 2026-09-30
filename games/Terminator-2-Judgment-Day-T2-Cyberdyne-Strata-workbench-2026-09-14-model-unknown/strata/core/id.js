export function makeID() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  const bytes = new Uint8Array(16);
  if (globalThis.crypto?.getRandomValues) crypto.getRandomValues(bytes);
  else throw Error('Secure random numbers are not available.');
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}
