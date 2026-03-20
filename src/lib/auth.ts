import { getCookie } from '@tanstack/react-start/server'

export const SESSION_COOKIE_NAME = 'stayclean_session'

function toBase64Url(input: string | ArrayBuffer) {
  const bytes =
    typeof input === 'string' ? new TextEncoder().encode(input) : new Uint8Array(input)
  let binary = ''

  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }

  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function fromBase64Url(input: string) {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/')
  const padding = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4))
  return atob(normalized + padding)
}

async function hmac(secret: string, message: string) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )

  return crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message))
}

export async function createSessionToken(secret: string) {
  const payload = {
    sub: 'manager',
    exp: Date.now() + 1000 * 60 * 60 * 24 * 30,
  }
  const encodedPayload = toBase64Url(JSON.stringify(payload))
  const signature = toBase64Url(await hmac(secret, encodedPayload))

  return `${encodedPayload}.${signature}`
}

export async function verifySessionToken(token: string | undefined | null, secret: string) {
  if (!token) {
    return false
  }

  const [payload, signature] = token.split('.')
  if (!payload || !signature) {
    return false
  }

  const expected = toBase64Url(await hmac(secret, payload))
  if (expected !== signature) {
    return false
  }

  const parsed = JSON.parse(fromBase64Url(payload)) as { exp?: number }
  return typeof parsed.exp === 'number' && parsed.exp > Date.now()
}

export async function getServerAuthState(secret: string) {
  const token = getCookie(SESSION_COOKIE_NAME)
  return verifySessionToken(token, secret)
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'Lax' as const,
    secure: true,
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  }
}
