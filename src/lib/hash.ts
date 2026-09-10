/**
 * crypto.subtle needs a secure context (https, or the literal "localhost") —
 * it's undefined on a LAN IP like a phone hitting http://192.168.x.x:5173.
 * Falls back to a fast non-cryptographic hash; this key only needs to be
 * deterministic and collision-resistant enough for a cache lookup, not secure.
 */
function fnv1aHex(text: string): string {
  let hash = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

/** Hex-encoded hash, used to key cached audio by exact sentence text (§8). */
export async function hashText(text: string): Promise<string> {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const bytes = new TextEncoder().encode(text)
    const digest = await crypto.subtle.digest('SHA-256', bytes)
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
  }
  return fnv1aHex(text)
}
