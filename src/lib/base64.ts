const BASE64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/**
 * base64 → bytes.
 *
 * Hand-rolled rather than pulled from a package: React Native's `atob` has
 * moved between the engine and a polyfill more than once, and an image upload
 * silently producing garbage on one platform is a miserable bug to chase. Ten
 * lines that behave the same everywhere are worth more than the dependency.
 *
 * It lives here rather than beside the avatar upload that first needed it,
 * because receipts need exactly the same thing and two copies of a decoder is
 * two places for a subtle difference to hide.
 */
export function decodeBase64(input: string): Uint8Array {
  const clean = input.replace(/[^A-Za-z0-9+/]/g, '');
  const bytes = new Uint8Array((clean.length * 3) >> 2);

  let byte = 0;
  let buffer = 0;
  let bits = 0;

  for (const character of clean) {
    buffer = (buffer << 6) | BASE64_ALPHABET.indexOf(character);
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes[byte] = (buffer >> bits) & 0xff;
      byte += 1;
    }
  }

  return bytes.subarray(0, byte);
}
