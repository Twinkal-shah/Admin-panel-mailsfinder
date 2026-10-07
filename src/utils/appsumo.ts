/**
 * AppSumo licence tiers, as sold on the AppSumo listing.
 *
 * Mirrors `APPSUMO_TIERS` in the backend's `billing/constants/plan.catalog.ts`.
 * The admin API doesn't expose that catalog, so the allocations live here.
 * Prices are deliberately NOT copied: amount paid only ever comes from real
 * purchase records.
 */
export type AppsumoTierNumber = 1 | 2 | 3 | 4

export interface AppsumoTierDef {
  tier: AppsumoTierNumber
  planCode: string
  label: string
  /** One-time grant per licence. Not monthly, never refilled. */
  credits: number
  dailyCap: number
}

export const APPSUMO_TIERS: AppsumoTierDef[] = [
  { tier: 1, planCode: 'appsumo_t1', label: 'Tier 1', credits: 75_000, dailyCap: 3_000 },
  { tier: 2, planCode: 'appsumo_t2', label: 'Tier 2', credits: 130_000, dailyCap: 5_500 },
  { tier: 3, planCode: 'appsumo_t3', label: 'Tier 3', credits: 300_000, dailyCap: 12_000 },
  { tier: 4, planCode: 'appsumo_t4', label: 'Tier 4', credits: 700_000, dailyCap: 25_000 }
]

export interface AppsumoTierRow extends AppsumoTierDef {
  userCount: number
  /** userCount × the tier's allocation. */
  creditsAllocated: number
  /** userCount × the tier's daily cap. */
  dailyCapTotal: number
  /** Sum of `balances.appsumo` across the tier's users. */
  creditsRemaining: number
  /** Paid AppSumo purchase records belonging to this tier's users. */
  amountPaid: number
  /** How many of the tier's users have at least one such record. */
  usersWithPurchase: number
}

export interface AppsumoUserRow {
  userId: string
  fullName: string
  email: string
  tier: AppsumoTierNumber
  /** The tier's one-time grant (upgrades may have received more). */
  creditsAllocated: number
  creditsRemaining: number
  /** Null when no paid AppSumo purchase record matched this user. */
  amountPaid: number | null
  createdAt: string | null
  lastSeen: string | null
}

export interface AppsumoSummary {
  tiers: AppsumoTierRow[]
  users: AppsumoUserRow[]
  totals: Omit<AppsumoTierRow, keyof AppsumoTierDef>
}

function tierFromPlanCode(raw: unknown): AppsumoTierNumber | null {
  const m = /^appsumo_t([1-4])$/.exec(String(raw ?? '').trim().toLowerCase())
  return m ? (Number(m[1]) as AppsumoTierNumber) : null
}

/**
 * The backend writes AppSumo purchases with `planName` set to the tier label
 * ("AppSumo Tier 3"). Accept the plan code too in case that ever changes.
 */
function isAppsumoPurchasePlan(raw: unknown): boolean {
  const s = String(raw ?? '').trim().toLowerCase()
  return /^appsumo tier [1-4]$/.test(s) || /^appsumo_t[1-4]$/.test(s)
}

/**
 * AppSumo share of the dashboard's "Total revenue" for a date range.
 *
 * Mirrors the backend's totalRevenue filter (admin.dashboard.service.ts):
 * `paymentStatus === "paid"`, `countsAsRevenue !== false`, and paymentDate
 * from `from` 00:00:00.000 UTC through `to` 23:59:59.999 UTC. The bootstrap
 * rows don't carry `countsAsRevenue`, but the AppSumo service always writes
 * it as true, so every row matched here is inside the backend's total — which
 * is what makes `total - appsumo` the LemonSqueezy share with nothing counted
 * twice.
 *
 * Reads the RAW purchases: the store's mapper turns unknown statuses (e.g.
 * "failed") into "paid".
 */
export function appsumoRevenueInRange(rawPurchases: any[], from: string, to: string): number {
  const start = Date.parse(`${from}T00:00:00.000Z`)
  const end = Date.parse(`${to}T23:59:59.999Z`)
  let cents = 0
  for (const p of rawPurchases) {
    if (String(p?.paymentStatus ?? p?.status ?? '').toLowerCase() !== 'paid') continue
    if (p?.countsAsRevenue === false) continue
    if (!isAppsumoPurchasePlan(p?.planName ?? p?.plan_name)) continue
    const at = Date.parse(String(p?.paymentDate ?? p?.date ?? ''))
    if (!Number.isFinite(at) || at < start || at > end) continue
    // Sum in cents so $29 + $120.10 doesn't drift into float noise.
    cents += Math.round((Number(p?.amountPaid ?? p?.amount ?? 0) || 0) * 100)
  }
  return cents / 100
}

/**
 * Build the AppSumo breakdown from the raw bootstrap payload.
 *
 * Reads the RAW users/purchases rather than the mapped store rows, because
 * `normalizePlan` folds unknown plan codes (including `appsumo_t*`) into Free.
 *
 * A user counts towards the tier their `plan` currently names. A refunded
 * licence sets the plan back to Free, so it drops out here even though its
 * purchase row stays "paid". Amount paid is everything a current AppSumo user
 * has paid for AppSumo — an upgrade's difference row is filed under the tier
 * they ended up on, not the one they left.
 */
export function summarizeAppsumo(rawUsers: any[], rawPurchases: any[]): AppsumoSummary {
  const tierByUser = new Map<string, AppsumoTierNumber>()
  const userRows = new Map<string, AppsumoUserRow>()
  const rows = new Map<AppsumoTierNumber, AppsumoTierRow>(
    APPSUMO_TIERS.map(def => [
      def.tier,
      {
        ...def,
        userCount: 0,
        creditsAllocated: 0,
        dailyCapTotal: 0,
        creditsRemaining: 0,
        amountPaid: 0,
        usersWithPurchase: 0
      }
    ])
  )

  for (const u of rawUsers) {
    const tier = tierFromPlanCode(u?.plan)
    if (!tier) continue
    const row = rows.get(tier)!
    const userId = String(u._id ?? u.id)
    const remaining = Number(u?.balances?.appsumo ?? u?.appsumo_balance ?? 0) || 0
    tierByUser.set(userId, tier)
    row.userCount += 1
    row.creditsAllocated += row.credits
    row.dailyCapTotal += row.dailyCap
    row.creditsRemaining += remaining
    userRows.set(userId, {
      userId,
      fullName: String(u?.full_name ?? ''),
      email: String(u?.email ?? ''),
      tier,
      creditsAllocated: row.credits,
      creditsRemaining: remaining,
      amountPaid: null,
      createdAt: u?.createdAt ? String(u.createdAt) : null,
      lastSeen: u?.lastSeen ? String(u.lastSeen) : null
    })
  }

  const paidUsers = new Set<string>()
  for (const p of rawPurchases) {
    const status = String(p?.paymentStatus ?? p?.status ?? '').toLowerCase()
    if (status !== 'paid') continue
    if (!isAppsumoPurchasePlan(p?.planName ?? p?.plan_name)) continue
    const userId = String(p?.userId ?? '')
    const tier = tierByUser.get(userId)
    if (!tier) continue
    const row = rows.get(tier)!
    const amount = Number(p?.amountPaid ?? p?.amount ?? 0) || 0
    row.amountPaid += amount
    const userRow = userRows.get(userId)!
    userRow.amountPaid = (userRow.amountPaid ?? 0) + amount
    if (!paidUsers.has(userId)) {
      paidUsers.add(userId)
      row.usersWithPurchase += 1
    }
  }

  const tiers = APPSUMO_TIERS.map(def => rows.get(def.tier)!)
  const totals = tiers.reduce(
    (acc, r) => ({
      userCount: acc.userCount + r.userCount,
      creditsAllocated: acc.creditsAllocated + r.creditsAllocated,
      dailyCapTotal: acc.dailyCapTotal + r.dailyCapTotal,
      creditsRemaining: acc.creditsRemaining + r.creditsRemaining,
      amountPaid: acc.amountPaid + r.amountPaid,
      usersWithPurchase: acc.usersWithPurchase + r.usersWithPurchase
    }),
    {
      userCount: 0,
      creditsAllocated: 0,
      dailyCapTotal: 0,
      creditsRemaining: 0,
      amountPaid: 0,
      usersWithPurchase: 0
    }
  )

  // Highest tier first, then newest licence holder.
  const users = Array.from(userRows.values()).sort(
    (a, b) => b.tier - a.tier || String(b.createdAt).localeCompare(String(a.createdAt))
  )

  return { tiers, users, totals }
}
