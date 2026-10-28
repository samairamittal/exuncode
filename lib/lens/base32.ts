// RFC 4648 Base32 (A–Z, 2–7), padding optional. Used on the machine ID.

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

/** True when `value` is plausibly Base32: alphabet only, long enough to mean something. */
export function looksLikeBase32(value: string): boolean {
  return /^[A-Z2-7]{8,}=*$/.test(value);
}

/** Decodes Base32 to UTF-8 text. Returns null if a character is outside the alphabet. */
export function decodeBase32(value: string): string | null {
  const clean = value.toUpperCase().replace(/=+$/, "");
  let bits = 0;
  let buffer = 0;
  const bytes: number[] = [];
  for (const char of clean) {
    const index = ALPHABET.indexOf(char);
    if (index < 0) return null;
    buffer = (buffer << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((buffer >> bits) & 0xff);
    }
  }
  return new TextDecoder().decode(new Uint8Array(bytes));
}
