import type React from 'react'

export type PlanId = 'free' | 'monthly' | 'lifetime' | 'payg'

export const PLAN_ORDER: PlanId[] = ['free', 'monthly', 'lifetime', 'payg']

/**
 * Plan colours now live in src/styles/globals.css as `--plan-*` tokens, split
 * per theme so every badge clears WCAG AA. The previous single hex set could
 * not: on a 12% tint, `lifetime` measured 3.10:1 and `payg` 2.11:1 in light,
 * while `free` (1.82:1) and `monthly` (2.65:1) failed in dark.
 *
 * Converted components use PLAN_VAR / planColor / planDotStyle below.
 */
export const PLAN_VAR: Record<PlanId, string> = {
  free: 'var(--plan-free)',
  monthly: 'var(--plan-monthly)',
  lifetime: 'var(--plan-lifetime)',
  payg: 'var(--plan-payg)'
}

/** Chart series colour for a plan. Reads the themed token, so no JS branching. */
export function planColor(plan: PlanId): string {
  return PLAN_VAR[plan]
}

/** Inline style for a legend or indicator dot. */
export function planDotStyle(plan: PlanId): React.CSSProperties {
  return { background: PLAN_VAR[plan] }
}

/**
 * Badge colours as inline custom properties. Kept as a style object rather
 * than a class string because Tailwind cannot statically extract an arbitrary
 * value built from a runtime variable, so `bg-[${...}]` would silently emit no
 * CSS at all.
 */
export function planBadgeStyle(plan: PlanId): React.CSSProperties {
  const c = PLAN_VAR[plan]
  return {
    color: c,
    backgroundColor: `color-mix(in oklch, ${c} calc(var(--plan-surface-alpha) * 100%), transparent)`
  }
}

/** Left-rail accent for a table row, token-driven. */
export function planRowAccent(plan: PlanId): React.CSSProperties {
  return { boxShadow: `inset 3px 0 0 0 ${PLAN_VAR[plan]}` }
}
