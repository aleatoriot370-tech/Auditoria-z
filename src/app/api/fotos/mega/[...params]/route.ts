import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/fotos/mega/[file_id]?k=[key]
 *
 * Proxy that downloads a public MEGA file, decrypts it (AES-CTR),
 * and serves it as an image with caching headers.
 *
 * MEGA encryption scheme:
 *   1. Key is base64url-decoded into 8 × 32-bit integers
 *   2. AES key = key[0]^key[4], key[1]^key[5], key[2]^key[6], key[3]^key[7]
 *   3. IV = key[4], key[5], 0, 0  (128-bit counter, left-shifted by 64)
 *   4. File is AES-128-CTR encrypted
 */

// No server-side cache — browser cache handles it via Cache-Control headers.

// ── MEGA crypto helpers ─────────────────────────────────────────────

/** base64url → Buffer */
function base64UrlDecode(s: string): Buffer {
  s = s.replace(/-/g, '+').replace(/_/g, '/')
  while (s.length % 4) s += '='
  return Buffer.from(s, 'base64')
}

/** Convert 32-bit int array → Buffer (big-endian) */
function a32ToBuf(a: number[]): Buffer {
  const buf = Buffer.alloc(a.length * 4)
  for (let i = 0; i < a.length; i++) {
    buf.writeUInt32BE(a[i] >>> 0, i * 4)
  }
  return buf
}

/** Parse MEGA public file key (base64url) into crypto components */
function parseMegaKey(keyB64: string) {
  const keyBytes = base64UrlDecode(keyB64)
  const key32: number[] = []
  for (let i = 0; i < keyBytes.length; i += 4) {
    key32.push(keyBytes.readUInt32BE(i))
  }

  // AES key: XOR first 4 with last 4
  const k = [
    (key32[0] ^ key32[4]) >>> 0,
    (key32[1] ^ key32[5]) >>> 0,
    (key32[2] ^ key32[6]) >>> 0,
    (key32[3] ^ key32[7]) >>> 0,
  ]

  // IV for CTR mode
  const iv0 = key32[4] >>> 0
  const iv1 = key32[5] >>> 0

  return { k, iv0, iv1, keyBytes }
}

/** Build a 16-byte CTR nonce from iv0, iv1 */
function buildCtrNonce(iv0: number, iv1: number): Buffer {
  const nonce = Buffer.alloc(16)
  nonce.writeUInt32BE(iv0, 0)
  nonce.writeUInt32BE(iv1, 4)
  // bytes 8-15 stay zero (counter starts at 0)
  return nonce
}

/** XOR two buffers (same length) */
function xorBuf(a: Buffer, b: Buffer): Buffer {
  const out = Buffer.alloc(a.length)
  for (let i = 0; i < a.length; i++) out[i] = a[i] ^ b[i]
  return out
}

// ── MEGA API ────────────────────────────────────────────────────────

/** Get file metadata from MEGA API (public files) */
async function megaApiGet(fileId: string) {
  const resp = await fetch(`https://g.api.mega.co.nz/cs?id=1`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify([{ a: 'g', g: 1, p: fileId }]),
  })
  if (!resp.ok) throw new Error(`MEGA API error: ${resp.status}`)
  const json = await resp.json()
  if (typeof json === 'number') throw new Error(`MEGA API error code: ${json}`)
  const data = Array.isArray(json) ? json[0] : json
  if (!data?.g) throw new Error('MEGA file not found or not public')
  return data as { g: string; s: number; at: string }
}

/** Download + decrypt a public MEGA file */
async function downloadMegaFile(fileId: string, keyB64: string): Promise<{ data: Buffer; mime: string }> {
  const { k, iv0, iv1 } = parseMegaKey(keyB64)

  // 1. Get download URL
  const meta = await megaApiGet(fileId)
  const fileUrl: string = meta.g
  const fileSize: number = meta.s

  // 2. Download encrypted file
  const resp = await fetch(fileUrl)
  if (!resp.ok) throw new Error(`Download failed: ${resp.status}`)
  const encBuf = Buffer.from(await resp.arrayBuffer())

  // 3. Decrypt with AES-128-CTR
  const aesKey = a32ToBuf(k)
  const nonce = buildCtrNonce(iv0, iv1)

  // Manual CTR: generate keystream blocks and XOR with ciphertext
  const { createCipheriv } = await import('crypto')
  const decipher = createCipheriv('aes-128-ctr', aesKey, nonce)
  const decBuf = Buffer.concat([decipher.update(encBuf), decipher.final()])

  // 4. Detect MIME
  let mime = 'image/jpeg'
  if (decBuf[0] === 0x89 && decBuf[1] === 0x50) mime = 'image/png'
  else if (decBuf[8] === 0x57 && decBuf[9] === 0x45 && decBuf[10] === 0x42 && decBuf[11] === 0x50) mime = 'image/webp'
  else if (decBuf[0] === 0x47 && decBuf[1] === 0x49) mime = 'image/gif'

  return { data: decBuf, mime }
}

// ── Route handler ───────────────────────────────────────────────────

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ params: string[] }> }
) {
  const session = await getSession()
  if (!session) return new NextResponse('Unauthorized', { status: 401 })

  const { params: pp } = await params
  const fileId = pp?.[0]
  const key = req.nextUrl.searchParams.get('k')
  if (!fileId) return new NextResponse('Missing file ID', { status: 400 })
  if (!key) return new NextResponse('Missing key (?k=)', { status: 400 })

  // Support ?url= mega link
  const fullUrl = req.nextUrl.searchParams.get('url')
  let fid = fileId
  let k = key
  if (fullUrl) {
    const m = fullUrl.match(/mega\.nz\/file\/([a-zA-Z0-9_-]+)#([a-zA-Z0-9_-]+)/)
    if (m) { fid = m[1]; k = m[2] }
    const m2 = fullUrl.match(/mega\.nz\/#!([a-zA-Z0-9_-]+)!([a-zA-Z0-9_-]+)/)
    if (m2) { fid = m2[1]; k = m2[2] }
  }

  try {
    const { data, mime } = await downloadMegaFile(fid, k)
    return new NextResponse(data, {
      headers: {
        'Content-Type': mime,
        // Browser cache: 7 dias. O browser gere a memória automaticamente.
        // Imagens ficam em cache enquanto o popup está aberto/reatomado,
        // e são libertadas quando o utilizador fecha a sessão.
        'Cache-Control': 'public, max-age=604800, stale-while-revalidate=86400',
      },
    })
  } catch (err: any) {
    console.error('[mega proxy] error:', err.message)
    return new NextResponse('MEGA error: ' + err.message, { status: 502 })
  }
}
