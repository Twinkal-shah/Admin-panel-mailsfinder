import axios, { AxiosError, AxiosRequestConfig, InternalAxiosRequestConfig } from 'axios'

export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ??
  (import.meta.env.DEV ? 'http://localhost:8000' : 'https://server.mailsfinder.com')

export const TOKEN_KEY = 'ADMIN_TOKEN'
export const REFRESH_TOKEN_KEY = 'ADMIN_REFRESH_TOKEN'

export function getAccessToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

export function getRefreshToken(): string | null {
  try {
    return localStorage.getItem(REFRESH_TOKEN_KEY)
  } catch {
    return null
  }
}

export function setTokens(accessToken: string | null, refreshToken?: string | null) {
  try {
    if (accessToken) localStorage.setItem(TOKEN_KEY, accessToken)
    else localStorage.removeItem(TOKEN_KEY)
    if (refreshToken !== undefined) {
      if (refreshToken) localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken)
      else localStorage.removeItem(REFRESH_TOKEN_KEY)
    }
  } catch {}
}

export function clearTokens() {
  try {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(REFRESH_TOKEN_KEY)
  } catch {}
}

let refreshPromise: Promise<string | null> | null = null
let onUnauthorized: (() => void) | null = null

export function setUnauthorizedHandler(handler: () => void) {
  onUnauthorized = handler
}

async function doRefresh(): Promise<string | null> {
  const refreshToken = getRefreshToken()
  if (!refreshToken) return null
  try {
    const res = await fetch(`${API_BASE_URL}/api/admin/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken })
    })
    if (!res.ok) return null
    const body = await res.json().catch(() => ({} as any))
    const next: string | undefined =
      body?.data?.accessToken ||
      body?.data?.token ||
      body?.accessToken ||
      body?.token
    if (!next) return null
    setTokens(next)
    return next
  } catch {
    return null
  }
}

function refreshAccessToken(): Promise<string | null> {
  if (!refreshPromise) {
    refreshPromise = doRefresh().finally(() => {
      refreshPromise = null
    })
  }
  return refreshPromise
}

export const api = axios.create({ baseURL: API_BASE_URL })

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = getAccessToken()
  if (token && config.headers) {
    config.headers.set?.('Authorization', `Bearer ${token}`)
  }
  return config
})

api.interceptors.response.use(
  res => res,
  async (error: AxiosError<any>) => {
    const original = error.config as (AxiosRequestConfig & { _retry?: boolean }) | undefined
    const status = error.response?.status
    const jwtError = (error.response?.data as any)?.jwtError === true
    if (status === 401 && jwtError && original && !original._retry) {
      original._retry = true
      const next = await refreshAccessToken()
      if (next) {
        original.headers = { ...(original.headers || {}), Authorization: `Bearer ${next}` }
        return api.request(original)
      }
      clearTokens()
      onUnauthorized?.()
    }
    return Promise.reject(error)
  }
)

export interface ApiFetchOptions extends RequestInit {
  skipAuth?: boolean
}

export async function apiFetch(path: string, options: ApiFetchOptions = {}): Promise<Response> {
  const url = path.startsWith('http') ? path : `${API_BASE_URL}${path}`
  const headers = new Headers(options.headers || {})
  if (!options.skipAuth) {
    const token = getAccessToken()
    if (token) headers.set('Authorization', `Bearer ${token}`)
  }
  const init: RequestInit = { ...options, headers }
  let res = await fetch(url, init)
  if (res.status !== 401) return res
  let body: any = null
  try {
    const cloned = res.clone()
    body = await cloned.json()
  } catch {}
  if (body?.jwtError !== true) return res
  const next = await refreshAccessToken()
  if (!next) {
    clearTokens()
    onUnauthorized?.()
    return res
  }
  headers.set('Authorization', `Bearer ${next}`)
  res = await fetch(url, { ...options, headers })
  return res
}
