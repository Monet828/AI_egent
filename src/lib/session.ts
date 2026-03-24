// sessionStorageの安全な読み書きヘルパー

export function getSessionData<T>(key: string): T | null {
  try {
    const data = sessionStorage.getItem(key);
    if (!data) return null;
    return JSON.parse(data) as T;
  } catch {
    sessionStorage.removeItem(key);
    return null;
  }
}

export function setSessionData(key: string, value: unknown): void {
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // QuotaExceededError 等を無視
  }
}
