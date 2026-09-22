import { PLANS, type Plan } from '../types/types'

export type PlanId = Plan

/** Badge order, filter order and pie-slice order all follow the one plan list. */
export const PLAN_ORDER: PlanId[] = PLANS

// Plan colors. Free stays neutral (it's "no plan"); the legacy crimson ramp
// (monthly/lifetime/payg) pulls from the production frontend's chart palette so
// badges and pie slices feel like one product.
//
// The 2026-09-21 tiers (starter/growth/agency) needed three more slots, and the
// crimson ramp had no room left — its steps are already only ΔE 11.9 apart for
// normal vision, below the 15 floor. So they take distinct hues instead, chosen
// against the dark chart surface and validated as a set: all six checks pass in
// both light and dark mode (worst adjacent CVD ΔE 8.4, normal-vision ΔE 19.8).
//
// Identity is never carried by color alone here — every badge prints its plan
// name and the donut has a legend and tooltip — which is what keeps the legacy
// crimson steps usable at all.
export const PLAN_COLORS: Record<PlanId, string> = {
  free: '#5a4042',
  starter: '#c98500',
  growth: '#199e70',
  agency: '#9085e9',
  monthly: '#b71d3f',
  lifetime: '#fc536d',
  payg: '#ff8fa3'
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace('#', '')
  const bigint = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16)
  const r = (bigint >> 16) & 255
  const g = (bigint >> 8) & 255
  const b = bigint & 255
  return { r, g, b }
}

export function tintedBg(hex: string, dark: boolean): string {
  const { r, g, b } = hexToRgb(hex)
  const alpha = dark ? 0.10 : 0.12
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

export function badgeStyles(plan: PlanId, dark: boolean): { bg: string; text: string; border: string; hoverShadow: string } {
  const color = PLAN_COLORS[plan]
  const bg = tintedBg(color, dark)
  const text = color
  const border = color
  const hoverShadow = `0 0 0 3px ${tintedBg(color, dark)}`
  return { bg, text, border, hoverShadow }
}

export function rowAccentStyle(plan: PlanId, dark: boolean): React.CSSProperties {
  const color = PLAN_COLORS[plan]
  const glow = dark ? `0 0 0 1px ${tintedBg(color, true)}` : `0 0 0 1px ${tintedBg(color, false)}`
  return {
    borderLeft: `3px solid ${color}`,
    boxShadow: glow
  }
}
