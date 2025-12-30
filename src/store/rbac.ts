import { Role, Scope } from '../types/types'

const roleScopes: Record<Role, Scope[]> = {
  superadmin: ['users.read', 'users.write', 'credits.adjust', 'content.publish', 'apikeys.manage'],
  product_manager: ['users.read', 'content.publish'],
  support: ['users.read', 'credits.adjust']
}

export function scopesForRole(role: Role): Scope[] {
  return roleScopes[role]
}

export function hasScope(role: Role, scope: Scope): boolean {
  return roleScopes[role].includes(scope)
}

