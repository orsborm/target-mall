export function getItem(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

export function setItem(key: string, value: string): void {
  try {
    localStorage.setItem(key, value)
  } catch {
    // storage full or unavailable
  }
}

export function removeItem(key: string): void {
  try {
    localStorage.removeItem(key)
  } catch {
    // storage unavailable
  }
}

/** Check if localStorage is available */
export function hasStorage(): boolean {
  try { const k = '__test__'; localStorage.setItem(k, k); localStorage.removeItem(k); return true } catch { return false }
}

/** Read and deserialize a JSON value from localStorage */
export function getJSON<T>(key: string): T | null {
  const raw = getItem(key)
  if (raw == null) return null
  try { return JSON.parse(raw) as T } catch { return null }
}

/** Serialize and write a JSON value to localStorage */
export function setJSON<T>(key: string, value: T): void {
  try { setItem(key, JSON.stringify(value)) } catch { /* storage full or unavailable */ }
}
