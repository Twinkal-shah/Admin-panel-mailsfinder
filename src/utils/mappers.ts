import { ApiKey, ContentItem, User } from '../types/types'

export function mapContent(raw: any): ContentItem {
  return {
    id: String(raw._id ?? raw.id),
    title: raw.title ?? '',
    slug: raw.slug ?? '',
    summary: raw.summary ?? undefined,
    body: raw.body ?? '',
    attachments: Array.isArray(raw.attachments) ? raw.attachments : [],
    published: !!(raw.published ?? raw.is_published),
    updatedAt:
      (raw.updatedAt && new Date(raw.updatedAt).toISOString()) ||
      (raw.createdAt && new Date(raw.createdAt).toISOString()) ||
      new Date().toISOString()
  }
}

export function mapUser(raw: any): User {
  const planRaw = String(raw.plan ?? 'free').toLowerCase()
  const plan: User['plan'] =
    planRaw === 'monthly' || planRaw === 'lifetime' || planRaw === 'payg'
      ? (planRaw as User['plan'])
      : 'free'

  const subsRaw: string =
    raw.subscription?.status ??
    raw.subscription_status ??
    (plan === 'free' ? 'none' : 'active')
  const subscription_status: User['subscription_status'] =
    subsRaw === 'active' || subsRaw === 'cancelled' || subsRaw === 'past_due'
      ? (subsRaw as User['subscription_status'])
      : 'none'

  const credits_find = Number(raw.credits_find ?? 0)
  const credits_verify = Number(raw.credits_verify ?? 0)
  const credits_total = Number(raw.credits ?? credits_find + credits_verify)

  return {
    id: String(raw._id ?? raw.id),
    full_name: String(raw.full_name ?? raw.name ?? ''),
    email: String(raw.email ?? ''),
    phone: raw.phone ?? undefined,
    country: raw.country ?? undefined,
    onboarding_flag:
      typeof raw.onboarding_flag === 'boolean'
        ? raw.onboarding_flag
        : raw.onboarding_completed === undefined
        ? undefined
        : !raw.onboarding_completed,
    createdAt: (raw.createdAt && new Date(raw.createdAt).toISOString()) || new Date().toISOString(),
    lastSeen:
      (raw.lastSeen && new Date(raw.lastSeen).toISOString()) ||
      (raw.updatedAt && new Date(raw.updatedAt).toISOString()) ||
      undefined,
    plan,
    credits_total,
    credits_find,
    credits_verify,
    subscription_status,
    email_verified: !!raw.email_verified,
    admin_notes: raw.admin_notes ?? undefined,
    monthly_balance: raw.monthly_balance,
    lifetime_balance: raw.lifetime_balance,
    payg_balance: raw.payg_balance,
    free_daily_balance: raw.free_daily_balance,
    billing_cycle: raw.billing_cycle,
    cycle_end_date: raw.cycle_end_date,
    lemonsqueezy_customer_id: raw.lemonsqueezy_customer_id,
    lemonsqueezy_portal_url: raw.lemonsqueezy_portal_url
  }
}

export function mapApiKey(raw: any): ApiKey {
  return {
    id: String(raw._id ?? raw.id),
    userId: raw.userId ? String(raw.userId) : undefined,
    keyPrefix: raw.keyPrefix ?? (typeof raw.apiKey === 'string' ? raw.apiKey.slice(0, 8) : ''),
    encryptedKey: 'hidden',
    rateLimitPerMinute: raw.rateLimitPerMinute ?? 60,
    lastUsedAt:
      (raw.lastUsedAt && new Date(raw.lastUsedAt).toISOString()) ||
      (raw.updatedAt && new Date(raw.updatedAt).toISOString()) ||
      undefined,
    usageCount: raw.usageCount ?? 0,
    status: raw.isActive === false ? 'revoked' : 'active',
    createdAt: (raw.createdAt && new Date(raw.createdAt).toISOString()) || new Date().toISOString()
  }
}
