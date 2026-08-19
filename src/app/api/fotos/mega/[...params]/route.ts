import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/fotos/mega/[file_id]#[key]
 *
 * Proxy that fetches an image from MEGA, decrypts it, and serves it
 * with proper caching headers. This allows <img> tags to display MEGA
 * images without requiring client-side JS decryption.
 *
 * The URL structure mirrors the MEGA URL:
 *   /api/fotos/mega/BR9RzCCA  (file_id from the MEGA URL path)
 *   The key is passed as a query param: ?k=kyl9slXvkeulqq5778...
 *
 * Alternative: pass the full MEGA URL as ?url=https://mega.nz/file/ID#KEY
 */

// Simple in-memory cache (resets on server restart / cold start)
const cache = new Map<string, { data: Buffer; mime: string; ts: number }>()
const CACHE_TTL = 24 * 60 * 60 * 1000 // 24 hours
const MAX_CACHE_SIZE = 200

function evictOldEntries() {
  if (cache.size <= MAX_CACHE_SIZE) return
  const now = Date.now()
  for (const [key, val] of cache) {
    if (now - val.ts > CACHE_TTL) cache.delete(key)
  }
}

/**
 * Convert MEGA's new URL format to the old format used by the API.
 * New: https://mega.nz/file/ID#KEY
 * Old: https://mega.nz/#!ID!KEY
 */
function megaUrlToApiParams(url: string): { file_id: string; key: string } | null {
  const m = url.match(/mega\.nz\/file\/([a-zA-Z0-9_-]+)#([a-zA-Z0-9_-]+)/)
  if (m) return { file_id: m[1], key: m[2] }
  // Old format
  const m2 = url.match(/mega\.nz\/#!([a-zA-Z0-9_-]+)!([a-zA-Z0-9_-]+)/)
  if (m2) return { file_id: m2[1], key: m2[2] }
  return null
}

/**
 * Fetch file metadata from MEGA's API (no auth needed for public files).
 */
async function getMegaFileMeta(fileId: string) {
  const resp = await fetch('https://g.api.mega.co.nz/cs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify([{ a: 'g', g: 1, n: fileId }]),
  })
  const data = await resp.json()
  if (!Array.isArray(data) || !data[0]?.g) {
    throw new Error('MEGA file not found or not public')
  }
  return data[0] // { g: download_url, s: size, at: attributes_encrypted }
}

/**
 * Decrypt MEGA attribute string to get the filename.
 * MEGA encrypts file attributes (name, etc.) with the file key.
 */
function decryptAttr(attrB64: string, keyBytes: Uint8Array): string | null {
  try {
    // The attribute is AES-CBC encrypted with the file key
    // For simplicity, we just return null — we don't need the filename for serving
    return null
  } catch {
    return null
  }
}

/**
 * Download and decrypt a file from MEGA.
 * This is a simplified implementation that works for single-file public links.
 */
async function downloadFromMega(fileId: string, key: string): Promise<{ data: Buffer; mime: string }> {
  // 1. Get download URL from MEGA API
  const meta = await getMegaFileMeta(fileId)
  const downloadUrl: string = meta.g
  const fileSize: number = meta.s

  // 2. Download the encrypted file
  const resp = await fetch(downloadUrl)
  if (!resp.ok) throw new Error(`MEGA download failed: ${resp.status}`)
  const encrypted = Buffer.from(await resp.arrayBuffer())

  // 3. Derive AES key from the URL key
  // MEGA key format: base64url with padding
  const keyB64 = key.replace(/-/g, '+').replace(/_/g, '/')
  const keyPadded = keyB64 + '=='.slice(0, (4 - (keyB64.length % 4)) % 4)
  const keyBytes = Buffer.from(keyPadded, 'base64')

  // MEGA uses AES-ECB for the file key, then AES-CTR for the file data
  // The 16-byte key is split: first 16 bytes = AES key, bytes 8-16 = IV parts
  const aesKey = keyBytes.slice(0, 16)
  const iv = Buffer.alloc(16)
  // IV is derived from bytes 8-15 of the key, XORed with the nonce
  keyBytes.copy(iv, 0, 8, 16)

  // 4. Decrypt with AES-CTR
  const crypto = await import('crypto')
  const decipher = crypto.createDecipheriv('aes-128-ctr', aesKey, iv)
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()])

  // 5. Detect MIME type
  let mime = 'image/jpeg'
  if (decrypted[0] === 0xFF && decrypted[1] === 0xD8) mime = 'image/jpeg'
  else if (decrypted[0] === 0x89 && decrypted[1] === 0x50) mime = 'image/png'
  else if (decrypted[8] === 0x57 && decrypted[9] === 0x45) mime = 'image/webp'
  else if (decrypted[0] === 0x47 && decrypted[1] === 0x49) mime = 'image/gif'

  return { data: decrypted, mime }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ params: string[] }> }
) {
  // Auth check
  const session = await getSession()
  if (!session) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  const { params: pathParams } = await params
  const fileId = pathParams?.[0]
  const key = req.nextUrl.searchParams.get('k')

  if (!fileId) {
    return new NextResponse('Missing file ID', { status: 400 })
  }

  // Support full URL as ?url= param
  const fullUrl = req.nextUrl.searchParams.get('url')
  let resolvedFileId = fileId
  let resolvedKey = key

  if (fullUrl) {
    const parsed = megaUrlToApiParams(fullUrl)
    if (parsed) {
      resolvedFileId = parsed.file_id
      resolvedKey = parsed.key
    }
  }

  if (!resolvedKey) {
    return new NextResponse('Missing decryption key (?k= param)', { status: 400 })
  }

  const cacheKey = `${resolvedFileId}`

  // Check cache
  const cached = cache.get(cacheKey)
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return new NextResponse(cached.data, {
      headers: {
        'Content-Type': cached.mime,
        'Cache-Control': 'public, max-age=86400, immutable',
        'X-Mega-Proxy': 'hit',
      },
    })
  }

  try {
    const { data, mime } = await downloadFromMega(resolvedFileId, resolvedKey)

    // Cache it
    evictOldEntries()
    cache.set(cacheKey, { data, mime, ts: Date.now() })

    return new NextResponse(data, {
      headers: {
        'Content-Type': mime,
        'Cache-Control': 'public, max-age=86400, immutable',
        'X-Mega-Proxy': 'miss',
      },
    })
  } catch (err: any) {
    console.error('[mega proxy] error:', err.message)
    return new NextResponse('Failed to fetch from MEGA: ' + err.message, { status: 502 })
  }
}
