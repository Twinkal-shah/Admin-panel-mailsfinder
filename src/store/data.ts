import { create } from 'zustand'
import { v4 as uuidv4 } from 'uuid'
import dayjs from 'dayjs'
import { ApiKey, AuditRow, ContentItem, Purchase, User } from '../types/types'
import { encrypt, toKeyPrefix } from '../utils/encrypt'

// NOTE: client-side encryption can only obscure, not protect — anyone with
// devtools can read this. Real protection must happen server-side. Track in
// docs/BACKEND_TODO.md.
const ENCRYPTION_SECRET = import.meta.env.VITE_ADMIN_KEY_ENCRYPTION_SECRET ?? ''

interface DataState {
  users: User[]
  purchases: Purchase[]
  apiKeys: ApiKey[]
  contents: ContentItem[]
  audits: AuditRow[]
  initEmptyState: () => void

  setAll: (payload: {
    users?: User[]
    purchases?: Purchase[]
    apiKeys?: ApiKey[]
    contents?: ContentItem[]
    audits?: AuditRow[]
  }) => void

  adjustCredits: (userId: string, delta: number, adminId: string, reason: string) => void
  bulkAdjustCredits: (userIds: string[], delta: number, adminId: string, reason: string) => void
  createApiKey: (payload: { userId?: string; rateLimitPerMinute: number }, adminId: string) => { fullKey: string; key: ApiKey }
  revokeApiKey: (keyId: string, adminId: string, reason?: string) => void
  updateApiKeyRateLimit: (keyId: string, rate: number) => void
  publishContent: (contentId: string, adminId: string, reason?: string) => void
  upsertContent: (content: Omit<ContentItem, 'id' | 'updatedAt' | 'published'> & Partial<Pick<ContentItem, 'id' | 'published'>>) => ContentItem
  updateUserNotes: (userId: string, notes: string) => void
  updateUser: (
    userId: string,
    patch: {
      plan?: User['plan']
      email_verified?: boolean
      country?: string
      admin_notes?: string
      payg_balance?: number
    }
  ) => void
  deleteUser: (userId: string) => void
}

export const useDataStore = create<DataState>((set) => ({
  users: [],
  purchases: [],
  apiKeys: [],
  contents: [],
  audits: [],
  initEmptyState: () => {
    set({ users: [], purchases: [], apiKeys: [], contents: [], audits: [] })
  },

  adjustCredits: (userId, delta, adminId, reason) => {
    set(state => {
      const users = state.users.map(u => {
        if (u.id !== userId) return u
        const nextPayg = Math.max(0, Number(u.payg_balance ?? 0) + delta)
        const nextAvailable = Math.max(0, Number(u.available_credits ?? 0) + delta)
        return {
          ...u,
          payg_balance: nextPayg,
          available_credits: nextAvailable,
          credits_total: nextAvailable,
          credits_find: nextAvailable,
          credits_verify: nextAvailable,
          balances: {
            ...u.balances,
            payg: { ...(u.balances?.payg ?? {}), balance: nextPayg }
          }
        }
      })
      const audits: AuditRow[] = [
        ...state.audits,
        {
          id: uuidv4(),
          adminId,
          action: 'credits.adjust',
          targetId: userId,
          timestamp: dayjs().toISOString(),
          reason
        }
      ]
      return { users, audits }
    })
  },

  bulkAdjustCredits: (userIds, delta, adminId, reason) => {
    const ids = new Set(userIds)
    set(state => {
      const users = state.users.map(u => {
        if (!ids.has(u.id)) return u
        const nextPayg = Math.max(0, Number(u.payg_balance ?? 0) + delta)
        const nextAvailable = Math.max(0, Number(u.available_credits ?? 0) + delta)
        return {
          ...u,
          payg_balance: nextPayg,
          available_credits: nextAvailable,
          credits_total: nextAvailable,
          credits_find: nextAvailable,
          credits_verify: nextAvailable,
          balances: {
            ...u.balances,
            payg: { ...(u.balances?.payg ?? {}), balance: nextPayg }
          }
        }
      })
      const ts = dayjs().toISOString()
      const audits: AuditRow[] = [
        ...state.audits,
        ...userIds.map(targetId => ({
          id: uuidv4(),
          adminId,
          action: 'credits.adjust' as const,
          targetId,
          timestamp: ts,
          reason
        }))
      ]
      return { users, audits }
    })
  },

  setAll: (payload) => {
    set(state => ({
      ...state,
      ...payload
    }))
  },

  createApiKey: ({ userId, rateLimitPerMinute }, adminId) => {
    const fullKey = uuidv4().replace(/-/g, '') + uuidv4().replace(/-/g, '')
    const key: ApiKey = {
      id: uuidv4(),
      userId,
      keyPrefix: toKeyPrefix(fullKey),
      encryptedKey: encrypt(fullKey, ENCRYPTION_SECRET),
      rateLimitPerMinute,
      usageCount: 0,
      status: 'active',
      createdAt: dayjs().toISOString()
    }
    set(state => ({
      apiKeys: [key, ...state.apiKeys],
      audits: [
        ...state.audits,
        {
          id: uuidv4(),
          adminId,
          action: 'apikey.create',
          targetId: key.id,
          timestamp: dayjs().toISOString()
        }
      ]
    }))
    return { fullKey, key }
  },

  revokeApiKey: (keyId, adminId, reason) => {
    set(state => ({
      apiKeys: state.apiKeys.map(k => (k.id === keyId ? { ...k, status: 'revoked' } : k)),
      audits: [
        ...state.audits,
        {
          id: uuidv4(),
          adminId,
          action: 'apikey.revoke',
          targetId: keyId,
          timestamp: dayjs().toISOString(),
          reason
        }
      ]
    }))
  },
  updateApiKeyRateLimit: (keyId, rate) => {
    set(state => ({
      apiKeys: state.apiKeys.map(k => (k.id === keyId ? { ...k, rateLimitPerMinute: rate } : k))
    }))
  },

  publishContent: (contentId, adminId, reason) => {
    set(state => ({
      contents: state.contents.map(c => (c.id === contentId ? { ...c, published: true, updatedAt: dayjs().toISOString() } : c)),
      audits: [
        ...state.audits,
        {
          id: uuidv4(),
          adminId,
          action: 'content.publish',
          targetId: contentId,
          timestamp: dayjs().toISOString(),
          reason
        }
      ]
    }))
  },

  upsertContent: (content) => {
    const now = dayjs().toISOString()
    if (content.id) {
      const updated: ContentItem = {
        id: content.id,
        title: content.title,
        slug: content.slug,
        summary: content.summary,
        body: content.body,
        attachments: content.attachments || [],
        published: !!content.published,
        updatedAt: now
      }
      set(state => ({
        contents: state.contents.map(c => (c.id === content.id ? updated : c))
      }))
      return updated
    }
    const created: ContentItem = {
      id: uuidv4(),
      title: content.title,
      slug: content.slug,
      summary: content.summary,
      body: content.body,
      attachments: content.attachments || [],
      published: false,
      updatedAt: now
    }
    set(state => ({ contents: [created, ...state.contents] }))
    return created
  },

  updateUserNotes: (userId, notes) => {
    set(state => ({
      users: state.users.map(u => (u.id === userId ? { ...u, admin_notes: notes } : u))
    }))
  },

  updateUser: (userId, patch) => {
    set(state => ({
      users: state.users.map(u => {
        if (u.id !== userId) return u
        const next: User = {
          ...u,
          plan: patch.plan ?? u.plan,
          email_verified: patch.email_verified ?? u.email_verified,
          country: patch.country ?? u.country,
          admin_notes: patch.admin_notes ?? u.admin_notes
        }
        if (patch.payg_balance !== undefined) {
          const nextPayg = Math.max(0, Number(patch.payg_balance))
          const otherBuckets =
            Number(u.monthly_balance ?? 0) +
            Number(u.lifetime_balance ?? 0) +
            Number(u.free_daily_balance ?? 0)
          const nextAvailable = otherBuckets + nextPayg
          next.payg_balance = nextPayg
          next.available_credits = nextAvailable
          next.credits_total = nextAvailable
          next.credits_find = nextAvailable
          next.credits_verify = nextAvailable
          next.balances = {
            ...u.balances,
            payg: { ...(u.balances?.payg ?? {}), balance: nextPayg }
          }
        }
        return next
      })
    }))
  },

  deleteUser: (userId) => {
    set(state => ({
      users: state.users.filter(u => u.id !== userId)
    }))
  }
}))
