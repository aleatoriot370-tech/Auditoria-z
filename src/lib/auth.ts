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

export async function getSession(): Promise<SessionPayload | null> {
  const store = await cookies()
  const raw = store.get(SESSION_COOKIE)?.value
  if (!raw) return null
  try {
    const json = Buffer.from(raw, 'base64').toString('utf-8')
    const parsed = JSON.parse(json) as SessionPayload
    if (!parsed.id_user || !parsed.Tipo) return null
    return parsed
  } catch {
    return null
  }
}

export async function setSession(payload: SessionPayload): Promise<void> {
  const store = await cookies()
  const encoded = Buffer.from(JSON.stringify(payload), 'utf-8').toString('base64')
  store.set(SESSION_COOKIE, encoded, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 8, // 8h
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
