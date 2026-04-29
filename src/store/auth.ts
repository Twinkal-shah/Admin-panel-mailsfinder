import { create } from 'zustand'
import { Role } from '../types/types'
import { scopesForRole } from './rbac'
import { jwtDecode } from 'jwt-decode'

const VALID_ROLES: readonly Role[] = ['superadmin', 'product_manager', 'support']

function roleFromPayload(payload: any): Role {
  const raw = payload?.role
  if (typeof raw === 'string' && (VALID_ROLES as readonly string[]).includes(raw)) {
    return raw as Role
  }
  return 'superadmin'
}

interface Admin {
  id: string
  name: string
  email: string
  role: Role
  scopes: string[]
}

interface AuthState {
  admin: Admin
  token?: string
  isAuthenticated: boolean
  login: (admin: Omit<Admin, 'scopes'>, token: string, refreshToken?: string) => void
  logout: () => void
  restoreFromToken: () => void
}

export const useAuthStore = create<AuthState>((set) => {
  const initialToken = (() => {
    try {
      return localStorage.getItem('ADMIN_TOKEN') || undefined
    } catch {
      return undefined
    }
  })()

  const adminFromToken = (() => {
    if (!initialToken) return null
    try {
      const payload: any = jwtDecode(initialToken)
      const now = Math.floor(Date.now() / 1000)
      if (payload?.exp && payload.exp < now) return null
      const role: Role = roleFromPayload(payload)
      return {
        id: String(payload.adminId ?? payload.sub ?? ''),
        name: '',
        email: String(payload.email ?? ''),
        role,
        scopes: scopesForRole(role)
      } as Admin
    } catch {
      return null
    }
  })()

  return {
    admin:
      adminFromToken ?? {
        id: '',
        name: '',
        email: '',
        role: 'superadmin',
        scopes: scopesForRole('superadmin')
      },
    token: initialToken,
    isAuthenticated: !!adminFromToken,
    login: (admin, token, refreshToken) => {
      try {
        localStorage.setItem('ADMIN_TOKEN', token)
        if (refreshToken) localStorage.setItem('ADMIN_REFRESH_TOKEN', refreshToken)
      } catch {}
      set({
        admin: { ...admin, scopes: scopesForRole(admin.role) },
        token,
        isAuthenticated: true
      })
    },
    logout: () => {
      try {
        localStorage.removeItem('ADMIN_TOKEN')
        localStorage.removeItem('ADMIN_REFRESH_TOKEN')
      } catch {}
      set({
        admin: {
          id: '',
          name: '',
          email: '',
          role: 'superadmin',
          scopes: scopesForRole('superadmin')
        },
        token: undefined,
        isAuthenticated: false
      })
    },
    restoreFromToken: () => {
      let token: string | undefined
      try {
        token = localStorage.getItem('ADMIN_TOKEN') || undefined
      } catch {
        token = undefined
      }
      if (!token) {
        set({ token: undefined, isAuthenticated: false })
        return
      }
      try {
        const payload: any = jwtDecode(token)
        const now = Math.floor(Date.now() / 1000)
        if (payload?.exp && payload.exp < now) {
          set({ token: undefined, isAuthenticated: false })
          return
        }
        const role: Role = roleFromPayload(payload)
        set({
          admin: {
            id: String(payload.adminId ?? payload.sub ?? ''),
            name: '',
            email: String(payload.email ?? ''),
            role,
            scopes: scopesForRole(role)
          },
          token,
          isAuthenticated: true
        })
      } catch {
        set({ token: undefined, isAuthenticated: false })
      }
    }
  }
})
