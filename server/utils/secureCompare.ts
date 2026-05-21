import { createHash, timingSafeEqual } from 'node:crypto'

/**
 * Compare two secret strings without length-dependent early exits.
 *
 * Node's timingSafeEqual requires equal-length buffers, so comparing raw
 * buffers either throws on length mismatch or tempts callers into truncation.
 * Hashing both inputs first gives timingSafeEqual fixed-size buffers while
 * still requiring the original byte lengths to match.
 */
export function timingSafeStringEqual(actual: string, expected: string): boolean {
  const actualDigest = createHash('sha256').update(actual, 'utf8').digest()
  const expectedDigest = createHash('sha256').update(expected, 'utf8').digest()

  return (
    timingSafeEqual(actualDigest, expectedDigest)
    && Buffer.byteLength(actual, 'utf8') === Buffer.byteLength(expected, 'utf8')
  )
}
