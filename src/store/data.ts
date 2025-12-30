import { create } from 'zustand'
import { v4 as uuidv4 } from 'uuid'
import dayjs from 'dayjs'
import { ApiKey, AuditRow, ContentItem, Purchase, User } from '../types/types'
import { encrypt, toKeyPrefix } from '../utils/encrypt'

const ENCRYPTION_SECRET = 'demo-secret'

interface DataState {
  users: User[]
  purchases: Purchase[]
  apiKeys: ApiKey[]
  contents: ContentItem[]
  audits: AuditRow[]
  initDemoData: () => void

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
}

export const useDataStore = create<DataState>((set, get) => ({
  users: [],
  purchases: [],
  apiKeys: [],
  contents: [],
  audits: [],
  initDemoData: () => {
    const now = dayjs()
    const seed = [
      { full_name: 'Adwaith R Rajesh', email: 'adwaithrrajesh.dev@gmail.com' },
      { full_name: 'Harsh Shah', email: 'harshshah419@gmail.com' },
      { full_name: 'Twinkal Shah', email: 'twinkal@mailsfinder.com' },
      { full_name: 'Krish', email: 'krish@flowxperia.com' }
    ]
    const users: User[] = seed.map((base, i) => {
      const id = uuidv4()
      const plan: User['plan'] = i % 4 === 0 ? 'free' : i % 4 === 1 ? 'pro' : i % 4 === 2 ? 'agency' : 'lifetime'
      const subs: User['subscription_status'] = plan === 'free' ? 'none' : 'active'
      const credits_find = Math.floor(Math.random() * 200000)
      const credits_verify = Math.floor(Math.random() * 200000)
      const createdAt = now.subtract(Math.floor(Math.random() * 120), 'day').toISOString()
      const lastSeen = now.subtract(Math.floor(Math.random() * 40), 'day').toISOString()
      return {
        id,
        full_name: base.full_name,
        email: base.email,
        phone: undefined,
        country: undefined,
        onboarding_flag: true,
        createdAt,
        lastSeen,
        plan,
        credits_total: credits_find + credits_verify,
        credits_find,
        credits_verify,
        subscription_status: subs,
        email_verified: true
      }
    })
    const purchases: Purchase[] = users
      .filter(u => u.plan !== 'free')
      .map(u => ({
        id: uuidv4(),
        userId: u.id,
        planName: u.plan,
        status: Math.random() > 0.1 ? 'paid' : 'refunded',
        date: dayjs(u.createdAt).add(Math.floor(Math.random() * 20), 'day').toISOString(),
        amount: u.plan === 'pro' ? 49 : u.plan === 'agency' ? 99 : u.plan === 'lifetime' ? 199 : 0
      }))
    const apiKeys: ApiKey[] = users.slice(0, 10).map(u => {
      const full = uuidv4().replace(/-/g, '') + uuidv4().replace(/-/g, '')
      return {
        id: uuidv4(),
        userId: u.id,
        keyPrefix: toKeyPrefix(full),
        encryptedKey: encrypt(full, ENCRYPTION_SECRET),
        rateLimitPerMinute: 60,
        lastUsedAt: dayjs().subtract(Math.floor(Math.random() * 10), 'day').toISOString(),
        usageCount: Math.floor(Math.random() * 1000),
        status: 'active',
        createdAt: dayjs().subtract(Math.floor(Math.random() * 60), 'day').toISOString()
      }
    })
    set({ users, purchases, apiKeys })
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
  }
}))
