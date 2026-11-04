import { createHash, randomBytes } from 'crypto'

/** Generate a UUID v4-style ID */
export function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16)
  })
}

/** SHA-256 hash a string (for IP/matric hashing) */
export function sha256(str) {
  return createHash('sha256').update(str).digest('hex')
}

/** Generate a random seed string */
export function randomSeed() {
  return randomBytes(16).toString('hex')
}
