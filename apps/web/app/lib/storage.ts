interface StorageAdapter {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

class SafeLocalStorage implements StorageAdapter {
  private isAvailable(): boolean {
    try {
      return typeof window !== 'undefined' && 'localStorage' in window;
    } catch {
      return false;
    }
  }

  getItem(key: string): string | null {
    if (!this.isAvailable()) return null;
    try {
      return localStorage.getItem(key);
    } catch (error) {
      console.warn(`Failed to get localStorage item: ${key}`, error);
      return null;
    }
  }

  setItem(key: string, value: string): void {
    if (!this.isAvailable()) return;
    try {
      localStorage.setItem(key, value);
    } catch (error) {
      console.warn(`Failed to set localStorage item: ${key}`, error);
    }
  }

  removeItem(key: string): void {
    if (!this.isAvailable()) return;
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.warn(`Failed to remove localStorage item: ${key}`, error);
    }
  }
}

export const storage = new SafeLocalStorage();

// 型安全なJSON操作
export function getStorageJson<T>(key: string, defaultValue: T): T {
  const item = storage.getItem(key);
  if (item === null) return defaultValue;
  
  try {
    return JSON.parse(item) as T;
  } catch (error) {
    console.warn(`Failed to parse JSON from localStorage: ${key}`, error);
    return defaultValue;
  }
}

export function setStorageJson<T>(key: string, value: T): void {
  try {
    if (value === undefined) {
      removeStorageJson(key);
      return;
    }
    storage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.warn(`Failed to stringify JSON for localStorage: ${key}`, error);
  }
}

export function removeStorageJson(key: string): void {
  try {
    storage.removeItem(key);
  } catch(error) {
    console.warn(`Failed to remove JSON from localStorage: ${key}`, error);
  }
}