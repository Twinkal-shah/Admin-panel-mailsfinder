export type Plan =
  | 'free'
  | 'starter'
  | 'growth'
  | 'agency'
  | 'monthly' // legacy tier — grandfathered subscribers only, closed to new checkouts
  | 'lifetime'
  | 'payg'
export type SubscriptionStatus = 'active' | 'cancelled' | 'past_due' | 'none'
export type CountryCode = string

/**
 * Every plan the backend can send, in display order.
 *
 * This is the ONE list. `normalizePlan`, `PLAN_ORDER` (badge colors, filter
 * dropdowns) and the plan edit form all read from it, so a new tier can't be
 * added to some of them and forgotten in the others — which is exactly how
 * Starter/Growth/Agency customers ended up rendering as "Free".
 *
 * Mirrors `PlanCode` in the backend's `billing/constants/plan.catalog.ts`.
 */
export const PLANS: Plan[] = [
  'free',
  'starter',
  'growth',
  'agency',
  'monthly',
  'lifetime',
  'payg'
]

export const PLAN_DISPLAY_NAME: Record<Plan, string> = {
  free: 'Free',
  starter: 'Starter',
  growth: 'Growth',
  agency: 'Agency',
  // Backend calls this "Monthly (legacy)". Worth surfacing: these subscribers
  // are grandfathered on 300k credits/cycle and exempt from cycle expiry.
  monthly: 'Monthly (legacy)',
  lifetime: 'Lifetime',
  payg: 'Pay-as-you-go'
}

/**
 * Plan codes that can be bought on an annual term, and so can carry the
 * "Annual" suffix. `monthly` is excluded on purpose: it is the closed legacy
 * tier and already renders its own "(legacy)" marker. Free / PAYG / Lifetime
 * have no billing cycle to qualify.
 */
const ANNUAL_SUFFIXED_PLANS: Plan[] = ['starter', 'growth', 'agency']

/**
 * Plan label for a SINGLE user, qualified with the billing term.
 *
 * An annual subscriber renders as "Starter Annual" rather than "Starter", so
 * the term is visible in the users table and on the user page without having
 * to cross-reference the separate "billing cycle" field.
 *
 * Aggregate views — the users-by-plan chart, the dashboard breakdown and the
 * plan filter dropdown — deliberately keep using PLAN_DISPLAY_NAME directly.
 * Those group by plan CODE, where an annual suffix would be meaningless
 * (monthly and annual subscribers share one bucket) and where the label has to
 * keep matching the value the filter sends to the API.
 */
export function planDisplayName(
  plan: Plan,
  billingCycle?: 'none' | 'monthly' | 'annual'
): string {
  const base = PLAN_DISPLAY_NAME[plan] ?? plan
  if (billingCycle === 'annual' && ANNUAL_SUFFIXED_PLANS.includes(plan)) {
    return `${base} Annual`
  }
  return base
}

/**
 * Read a plan value coming off the API.
 *
 * Unknown values still fall back to 'free' so the table keeps rendering, but
 * they now warn. The silent fallback is what hid the new pricing tiers for as
 * long as it did.
 */
export function normalizePlan(raw: unknown): Plan {
  const value = String(raw ?? 'free').trim().toLowerCase()
  if ((PLANS as string[]).includes(value)) return value as Plan
  if (value && value !== 'free') {
    console.warn(
      `[admin] Unknown plan "${value}" from API — rendering as Free. Add it to PLANS in src/types/types.ts.`
    )
  }
  return 'free'
}

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
  // DEPRECATED — equals available_credits, do not sum
  credits_total: number
  // DEPRECATED — equals available_credits, do not sum
  credits_find: number
  // DEPRECATED — equals available_credits, do not sum
  credits_verify: number
  available_credits?: number
  balances?: {
    monthly?: number
    lifetime?: number
    payg?: number
    free?: number
  }
  monthly_pool?: number
  lifetime_pool?: number
  monthly_daily_used?: number
  subscription?: { status?: string; subscriptionId?: string | null }
  cycle_start_date?: string | null
  cycle_end_date?: string | null
  billing_cycle?: 'none' | 'monthly' | 'annual'
  subscription_status: SubscriptionStatus
  email_verified: boolean
  admin_notes?: string
  monthly_balance?: number
  lifetime_balance?: number
  payg_balance?: number
  free_daily_balance?: number
  lemonsqueezy_customer_id?: string
  lemonsqueezy_portal_url?: string
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
  action: 'credits.adjust' | 'plan.grant' | 'apikey.create' | 'apikey.revoke' | 'content.publish'
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
