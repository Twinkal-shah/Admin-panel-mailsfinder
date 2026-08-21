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

/* ------------------------------------------------------------------------
 * DEPRECATED — hex + inline-style helpers below.
 *
 * Still referenced by the pages not yet converted (Dashboard, UsersList).
 * They are the reason plan badges currently fail AA, so they get deleted, not
 * extended, once those two pages move over in stage 2.
 * ---------------------------------------------------------------------- */

/** @deprecated use PLAN_VAR / planColor */
export const PLAN_COLORS: Record<PlanId, string> = {
  free: '#5a4042',
  monthly: '#b71d3f',
  lifetime: '#fc536d',
  payg: '#ff8fa3'
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace('#', '')
  const bigint = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16)
  return { r: (bigint >> 16) & 255, g: (bigint >> 8) & 255, b: bigint & 255 }
}

/** @deprecated */
export function tintedBg(hex: string, dark: boolean): string {
  const { r, g, b } = hexToRgb(hex)
  return `rgba(${r}, ${g}, ${b}, ${dark ? 0.1 : 0.12})`
}

/** @deprecated use planBadgeStyle */
export function badgeStyles(
  plan: PlanId,
  dark: boolean
): { bg: string; text: string; border: string; hoverShadow: string } {
  const color = PLAN_COLORS[plan]
  const bg = tintedBg(color, dark)
  return { bg, text: color, border: color, hoverShadow: `0 0 0 3px ${bg}` }
}

/** @deprecated use planRowAccent */
export function rowAccentStyle(plan: PlanId, dark: boolean): React.CSSProperties {
  const color = PLAN_COLORS[plan]
  return {
    borderLeft: `3px solid ${color}`,
    boxShadow: `0 0 0 1px ${tintedBg(color, dark)}`
  }
}
