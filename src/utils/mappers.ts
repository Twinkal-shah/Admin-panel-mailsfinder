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

  const rawBalances = raw.balances ?? {}
  // Backend now returns flat numbers per bucket. Tolerate older nested shape
  // ({ balance: N }) for safety while the deploy rolls out.
  const readBucket = (v: any): number =>
    typeof v === 'number' ? v : Number(v?.balance ?? 0)
  const monthly_balance = Number(readBucket(rawBalances.monthly) || raw.monthly_balance || 0)
  const lifetime_balance = Number(readBucket(rawBalances.lifetime) || raw.lifetime_balance || 0)
  const payg_balance = Number(readBucket(rawBalances.payg) || raw.payg_balance || 0)
  const free_daily_balance = Number(readBucket(rawBalances.free) || raw.free_daily_balance || 0)

  let available_credits: number
  if (raw.available_credits != null) {
    available_credits = Number(raw.available_credits)
  } else if (
    rawBalances.monthly != null ||
    rawBalances.lifetime != null ||
    rawBalances.payg != null ||
    rawBalances.free != null ||
    raw.monthly_balance != null ||
    raw.lifetime_balance != null ||
    raw.payg_balance != null ||
    raw.free_daily_balance != null
  ) {
    available_credits = monthly_balance + lifetime_balance + payg_balance + free_daily_balance
  } else {
    // Legacy fallback. NEVER sum credits_find + credits_verify — they're
    // identical mirrors of available_credits on the backend now.
    available_credits = Math.max(
      Number(raw.credits_find ?? 0),
      Number(raw.credits_verify ?? 0),
      Number(raw.credits ?? 0)
    )
  }

  const credits_total = available_credits
  const credits_find = available_credits
  const credits_verify = available_credits

  const billingRaw = String(raw.billing_cycle ?? 'none').toLowerCase()
  const billing_cycle: User['billing_cycle'] =
    billingRaw === 'monthly' || billingRaw === 'annual' ? (billingRaw as any) : 'none'

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
    available_credits,
    balances: {
      monthly: monthly_balance,
      lifetime: lifetime_balance,
      payg: payg_balance,
      free: free_daily_balance
    },
    monthly_pool: raw.monthly_pool != null ? Number(raw.monthly_pool) : undefined,
    lifetime_pool: raw.lifetime_pool != null ? Number(raw.lifetime_pool) : undefined,
    monthly_daily_used: raw.monthly_daily_used != null ? Number(raw.monthly_daily_used) : undefined,
    subscription: raw.subscription
      ? {
          status: raw.subscription.status,
          subscriptionId: raw.subscription.subscriptionId ?? null
        }
      : undefined,
    cycle_start_date: raw.cycle_start_date ?? null,
    cycle_end_date: raw.cycle_end_date ?? null,
    billing_cycle,
    subscription_status,
    email_verified: !!raw.email_verified,
    admin_notes: raw.admin_notes ?? undefined,
    monthly_balance,
    lifetime_balance,
    payg_balance,
    free_daily_balance,
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
