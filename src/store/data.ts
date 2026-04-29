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

  addCredits: (userId: string, delta: number, adminId: string, reason: string) => void
  createApiKey: (payload: { userId?: string; rateLimitPerMinute: number }, adminId: string) => { fullKey: string; key: ApiKey }
  revokeApiKey: (keyId: string, adminId: string, reason?: string) => void
  updateApiKeyRateLimit: (keyId: string, rate: number) => void
  publishContent: (contentId: string, adminId: string, reason?: string) => void
  upsertContent: (content: Omit<ContentItem, 'id' | 'updatedAt' | 'published'> & Partial<Pick<ContentItem, 'id' | 'published'>>) => ContentItem
  updateUserNotes: (userId: string, notes: string) => void
  updateUser: (userId: string, patch: { plan?: User['plan']; credits_total?: number; credits_find?: number; credits_verify?: number }) => void
  deleteUser: (userId: string) => void
}

export const useDataStore = create<DataState>((set, get) => ({
  users: [],
  purchases: [],
  apiKeys: [],
  contents: [],
  audits: [],
  initEmptyState: () => {
    set({ users: [], purchases: [], apiKeys: [], contents: [], audits: [] })
  },

  addCredits: (userId, delta, adminId, reason) => {
    set(state => {
      const users = state.users.map(u => {
        if (u.id !== userId) return u
        const isFind = delta >= 0
        const credits_find = u.credits_find + (isFind ? delta : 0)
        const credits_verify = u.credits_verify + (!isFind ? Math.abs(delta) : 0)
        const credits_total = credits_find + credits_verify
        return { ...u, credits_find, credits_verify, credits_total }
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
      users: state.users.map(u => (
        u.id === userId
          ? {
              ...u,
              plan: patch.plan ?? u.plan,
              credits_total: patch.credits_total ?? u.credits_total,
              credits_find: patch.credits_find ?? u.credits_find,
              credits_verify: patch.credits_verify ?? u.credits_verify
            }
          : u
      ))
    }))
  },

  deleteUser: (userId) => {
    set(state => ({
      users: state.users.filter(u => u.id !== userId)
    }))
  }
}))
