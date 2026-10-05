export const getCrypto = (): Crypto => {
  if (typeof globalThis !== 'undefined' && globalThis.crypto) {
    return globalThis.crypto;
  }
  if (typeof window !== 'undefined' && window.crypto) {
    return window.crypto;
  }
  throw new Error('WebCrypto API is not available in the current runtime environment.');
};

export const getSubtle = (): SubtleCrypto => {
  const crypto = getCrypto();
  if (!crypto.subtle) {
    throw new Error('WebCrypto SubtleCrypto is not available in the current runtime environment.');
  }
  return crypto.subtle;
};
