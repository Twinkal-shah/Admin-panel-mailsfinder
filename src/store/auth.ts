import { create } from 'zustand'
import { Role } from '../types/types'
import { scopesForRole } from './rbac'

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
  login: (admin: Omit<Admin, 'scopes'>, token: string) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  admin: {
    id: 'admin-1',
    name: 'Super Admin',
    email: 'admin@mailsfinder.com',
    role: 'superadmin',
    scopes: scopesForRole('superadmin')
  },
  token: undefined,
  isAuthenticated: false,
  login: (admin, token) =>
    set({
      admin: { ...admin, scopes: scopesForRole(admin.role) },
      token,
      isAuthenticated: true
    }),
  logout: () => set({ token: undefined, isAuthenticated: false })
}))

