import { getSecureKeyStore } from '@cinecraft/storage';

export const setSecureItem = async (key: string, value: string): Promise<void> => {
  await getSecureKeyStore().setKey(key, value);
};

export const getSecureItem = async (key: string): Promise<string | null> => {
  return await getSecureKeyStore().getKey(key);
};

export const removeSecureItem = async (key: string): Promise<void> => {
  await getSecureKeyStore().deleteKey(key);
};
