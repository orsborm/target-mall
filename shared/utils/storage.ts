export function getItem(key: string): string | null {
  if (!key) return null
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

// Returns boolean so callers can detect QuotaExceededError / SecurityError
// and degrade gracefully (e.g. warn the user, skip non-critical persistence).
export function setItem(key: string, value: string): boolean {
  if (!key) return false
  try {
    localStorage.setItem(key, value)
    return true
  } catch {
    console.warn('[storage] setItem failed:', key)
    return false
  }
}

export function removeItem(key: string): boolean {
  if (!key) return false
  try {
    localStorage.removeItem(key)
    return true
  } catch {
    return false
  }
}

/** Check if localStorage is available */
export function hasStorage(): boolean {
  try { const k = '__test__'; localStorage.setItem(k, k); localStorage.removeItem(k); return true } catch { return false }
}

/** Read and deserialize a JSON value from localStorage */
export function getJSON<T>(key: string): T | null {
  if (!key) return null
  const raw = getItem(key)
  if (raw == null) return null
  try { return JSON.parse(raw) as T } catch { return null }
}

/** Serialize and write a JSON value to localStorage.
 *  Returns false if the key is empty, value is undefined, serialization
 *  fails (circular refs, BigInt), or storage is full/unavailable. */
export function setJSON<T>(key: string, value: T): boolean {
  if (!key) return false
  if (value === undefined) {
    console.warn('[storage] setJSON: value is undefined for key:', key)
    return false
  }
  try { return setItem(key, JSON.stringify(value)) } catch { return false }
}
