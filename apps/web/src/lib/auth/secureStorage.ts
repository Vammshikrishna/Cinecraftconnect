export const secureStorageEngine = {
  getItem: async (key: string): Promise<string | null> => {
    try {
      if (typeof localStorage !== 'undefined') {
        return localStorage.getItem(key);
      }
      return null;
    } catch (e) {
      console.error('Error reading from storage:', e);
      return null;
    }
  },
  
  setItem: async (key: string, value: string): Promise<void> => {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(key, value);
      }
    } catch (e) {
      console.error('Error writing to storage:', e);
    }
  },
  
  removeItem: async (key: string): Promise<void> => {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(key);
      }
    } catch (e) {
      console.error('Error removing from storage:', e);
    }
  }
};

export const migrateLocalStorageSession = async () => {
  // Web does not need native migration
};
