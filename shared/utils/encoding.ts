/**
 * Fix double-encoded UTF-8 strings (CP1252 variant).
 * Backend stores UTF-8 data in MySQL cp1252 columns,
 * causing each UTF-8 byte to be re-encoded through CP1252→UTF-8.
 * Produces garbled text like "æ•°ç " instead of "数码".
 */

/** Map CP1252-specific Unicode code points back to their byte values */
function cp1252CharToByte(code: number): number | null {
  if (code <= 0x7F) return code
  if (code >= 0xA0 && code <= 0xFF) return code
  // CP1252 special mappings (printable chars in 0x80-0x9F range)
  const map: Record<number, number> = {
    0x20AC: 0x80, 0x201A: 0x82, 0x0192: 0x83, 0x201E: 0x84,
    0x2026: 0x85, 0x2020: 0x86, 0x2021: 0x87, 0x02C6: 0x88,
    0x2030: 0x89, 0x0160: 0x8A, 0x2039: 0x8B, 0x0152: 0x8C,
    0x2025: 0x8D, 0x017D: 0x8E, 0x2018: 0x91, 0x2019: 0x92, 0x201C: 0x93,
    0x201D: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97,
    0x02DC: 0x98, 0x2122: 0x99, 0x0161: 0x9A, 0x203A: 0x9B,
    0x0153: 0x9C, 0x017E: 0x9E, 0x0178: 0x9F,
  }
  if (map[code] !== undefined) return map[code]
  if (code >= 0x80 && code <= 0x9F) return code
  return null
}

const decoder = new TextDecoder('utf-8')

export function fixGarbledUtf8(str: string): string {
  if (!str || str.length < 2) return str

  let hasSuspect = false
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i)
    if (c >= 0x80 && c <= 0xFF) { hasSuspect = true; break }
  }
  if (!hasSuspect) return str

  try {
    const bytes: number[] = []
    for (let i = 0; i < str.length; i++) {
      const b = cp1252CharToByte(str.charCodeAt(i))
      if (b === null) return str
      bytes.push(b)
    }
    const decoded = decoder.decode(new Uint8Array(bytes))
    // CJK check: Unified + Extension A–F + Compatibility + Kana + Hangul
    if (/[一-鿿㐀-䶿豈-﫿⺀-⻿　-〿㇀-㇯가-힯぀-ゟ゠-ヿ]/.test(decoded)) return decoded
    // Fallback heuristic: if decoding significantly reduced the high-byte
    // density (0x80+), the fix likely succeeded even without visible CJK.
    const origHigh = [...str].filter(c => c.charCodeAt(0) >= 0x80).length
    const decHigh = [...decoded].filter(c => c.charCodeAt(0) >= 0x80).length
    if (origHigh > 0 && decHigh < origHigh * 0.5) return decoded
    return str
  } catch {
    return str
  }
}

function isDataUri(str: string): boolean {
  return /^data:[a-z]+\/[a-z+]+;base64,/i.test(str)
}
function isUrl(str: string): boolean {
  return /^https?:\/\//i.test(str)
}

const imageKeyRegex = /(image|avatar|captcha|icon|photo|img|base64)/i

// Max recursion depth and circular reference protection to prevent stack
// overflow on deeply nested API responses or self-referencing objects (P2-1).
const MAX_ENCODING_DEPTH = 100

export function deepFixEncoding<T>(data: T, key?: string, _depth = 0, _seen = new WeakSet<object>()): T {
  if (_depth > MAX_ENCODING_DEPTH) return data
  if (data === null || data === undefined) return data
  if (typeof data === 'string') {
    if (isDataUri(data) || isUrl(data)) return data
    if (key && imageKeyRegex.test(key)) return data
    return fixGarbledUtf8(data) as unknown as T
  }
  if (Array.isArray(data)) {
    return data.map((item, i) => deepFixEncoding(item, `${key || ''}[${i}]`, _depth + 1, _seen)) as unknown as T
  }
  if (typeof data === 'object') {
    if (_seen.has(data as object)) return data
    _seen.add(data as object)
    // Skip non-plain objects (Date, RegExp, Map, etc.) whose enumerable
    // properties would produce an empty clone.
    const proto = Object.getPrototypeOf(data)
    if (proto !== Object.prototype && proto !== Array.prototype && proto !== null) return data
    const result: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(data as Record<string, unknown>)) {
      result[k] = deepFixEncoding(v, k, _depth + 1, _seen)
    }
    return result as unknown as T
  }
  return data
}
