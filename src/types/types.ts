export type Plan = 'free' | 'pro' | 'agency' | 'lifetime'
export type SubscriptionStatus = 'active' | 'cancelled' | 'past_due' | 'none'
export type CountryCode = string

export interface User {
  id: string
  full_name: string
  email: string
  phone?: string
  country?: CountryCode
  onboarding_flag?: boolean
  createdAt: string
  lastSeen?: string
  plan: Plan
  credits_total: number
  credits_find: number
  credits_verify: number
  subscription_status: SubscriptionStatus
  email_verified: boolean
  admin_notes?: string
}

export interface Purchase {
  id: string
  userId: string
  planName: Plan
  status: 'paid' | 'refunded' | 'pending'
  date: string
  amount: number
}

export interface ApiKey {
  id: string
  userId?: string
  keyPrefix: string
  encryptedKey: string
  rateLimitPerMinute: number
  lastUsedAt?: string
  usageCount: number
  status: 'active' | 'revoked'
  createdAt: string
}

export interface ContentItem {
  id: string
  title: string
  slug: string
  summary?: string
  body: string
  attachments?: string[]
  published: boolean
  updatedAt: string
}

export interface AuditRow {
  id: string
  adminId: string
  action: 'credits.adjust' | 'apikey.create' | 'apikey.revoke' | 'content.publish'
  targetId: string
  timestamp: string
  reason?: string
}

export type Role = 'superadmin' | 'product_manager' | 'support'
export type Scope =
  | 'users.read'
  | 'users.write'
  | 'credits.adjust'
  | 'content.publish'
  | 'apikeys.manage'
