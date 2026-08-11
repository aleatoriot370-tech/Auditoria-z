import { cookies } from 'next/headers'
import type { User } from './types'

export const SESSION_COOKIE = 'lamoia_session'

export interface SessionPayload {
  id_user: number
  Nome: string | null
  Login: string | null
  Tipo: string | null
  Status: string | null
}

/**
 * Base64 helpers that work in both Node.js (Buffer) and edge runtimes (btoa/atob).
 * Using Buffer when available avoids pulling in polyfills.
 */
function encodeBase64(str: string): string {
  // Browser/edge runtime
  if (typeof btoa === 'function') {
    // First encode UTF-8 → binary string for btoa
    const utf8 = unescape(encodeURIComponent(str))
    return btoa(utf8)
  }
  // Node.js runtime
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(str, 'utf-8').toString('base64')
  }
  throw new Error('No base64 encoder available')
}

function decodeBase64(str: string): string {
  if (typeof atob === 'function') {
    const binary = atob(str)
    return decodeURIComponent(escape(binary))
  }
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(str, 'base64').toString('utf-8')
  }
  throw new Error('No base64 decoder available')
}

export async function getSession(): Promise<SessionPayload | null> {
  const store = await cookies()
  const raw = store.get(SESSION_COOKIE)?.value
  if (!raw) return null
  try {
    const json = decodeBase64(raw)
    const parsed = JSON.parse(json) as SessionPayload
    if (!parsed.id_user || !parsed.Tipo) return null
    return parsed
  } catch {
    return null
  }
}

export async function setSession(payload: SessionPayload): Promise<void> {
  const store = await cookies()
  const encoded = encodeBase64(JSON.stringify(payload))
  store.set(SESSION_COOKIE, encoded, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 8, // 8h
    // secure is automatically set by Next.js when running on HTTPS in production
  })
}

export async function clearSession(): Promise<void> {
  const store = await cookies()
  store.delete(SESSION_COOKIE)
}

export function isAuthorizedTipo(tipo: string | null | undefined): boolean {
  return !!tipo && ['Admin Senior', 'Admin Junior', 'Comercial'].includes(tipo)
}

export function isAdmin(tipo: string | null | undefined): boolean {
  return !!tipo && ['Admin Senior', 'Admin Junior'].includes(tipo)
}
