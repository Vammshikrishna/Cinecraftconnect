/**
 * Computes a human-readable Security Code fingerprint from two public key strings.
 * Example output: "AB72 91F4 8C23 7D10 49E1 01A8 923F 1120"
 */
export const generateSecurityFingerprint = async (
  publicKeyA: string,
  publicKeyB: string
): Promise<string> => {
  const sorted = [publicKeyA, publicKeyB].sort();
  const encoder = new TextEncoder();
  const data = encoder.encode(sorted.join('::'));

  const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  
  // Map hash bytes into 8 blocks of 4 hex uppercase characters
  const hex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
  const blocks = [];
  for (let i = 0; i < 32; i += 4) {
    blocks.push(hex.substring(i, i + 4));
  }
  return blocks.join(' ');
};
