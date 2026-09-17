/**
 * base64 to bytes, without depending on `atob` or `Buffer`.
 *
 * Hermes and Node both offer one of those, but not the same one, and this runs in both
 * the app and the test runner. Twenty lines is cheaper than a polyfill that has to be
 * right on two platforms.
 *
 * It lives here because two bundled fixtures now decode rasters this way — the
 * cumulative radar's windows and the Detailcharts field frames — and a second copy of a
 * decoder is a second place for it to be subtly wrong.
 */

const B64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

export function decodeBase64(input: string): Uint8Array {
  const clean = input.replace(/[^A-Za-z0-9+/]/g, '');
  const out = new Uint8Array((clean.length * 3) >> 2);
  let bits = 0;
  let acc = 0;
  let at = 0;

  for (let i = 0; i < clean.length; i++) {
    const value = B64_ALPHABET.indexOf(clean[i]!);
    if (value < 0) continue;
    acc = (acc << 6) | value;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out[at++] = (acc >> bits) & 0xff;
    }
  }
  return out.subarray(0, at);
}
