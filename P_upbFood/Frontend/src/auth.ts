const API_BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8080'

export type AuthSession = {
  success: boolean
  accessToken: string
  expiresIn: number
  email: string
  restauranteId: number
  message?: string
}

let accessToken: string | null = null

async function readJson<T>(response: Response): Promise<T> {
  return (await response.json()) as T
}

export async function login(email: string, password: string): Promise<AuthSession> {
  const response = await fetch(`${API_BASE_URL}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ email, password }),
  })
  const data = await readJson<AuthSession & { message?: string }>(response)

  if (!response.ok || !data.success) {
    throw new Error(data.message ?? 'Credenciales inválidas.')
  }

  accessToken = data.accessToken
  return data
}

export async function refreshSession(): Promise<AuthSession | null> {
  const response = await fetch(`${API_BASE_URL}/api/admin/refresh`, {
    method: 'POST',
    credentials: 'include',
  })

  if (!response.ok) {
    accessToken = null
    return null
  }

  const data = await readJson<AuthSession>(response)
  if (!data.success || !data.accessToken) {
    accessToken = null
    return null
  }

  accessToken = data.accessToken
  return data
}

export async function logout(): Promise<void> {
  try {
    await fetch(`${API_BASE_URL}/api/admin/logout`, {
      method: 'POST',
      credentials: 'include',
    })
  } finally {
    accessToken = null
  }
}

export async function apiFetch(input: RequestInfo | URL, init: RequestInit = {}, retry = true): Promise<Response> {
  const headers = new Headers(init.headers)
  if (accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`)
  }

  const response = await fetch(input, {
    ...init,
    headers,
    credentials: 'include',
  })

  if (response.status === 401 && retry) {
    const session = await refreshSession()
    if (session) {
      return apiFetch(input, init, false)
    }
  }

  return response
}

export function getApiBaseUrl(): string {
  return API_BASE_URL
}
