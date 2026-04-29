export type PlanId = 'free' | 'monthly' | 'lifetime' | 'payg'

export const PLAN_ORDER: PlanId[] = ['free', 'monthly', 'lifetime', 'payg']

// Brand-aligned plan colors. Free stays neutral (it's "no plan"); paid tiers
// pull from the production frontend's chart palette so badges and pie slices
// feel like one product.
export const PLAN_COLORS: Record<PlanId, string> = {
  free: '#5a4042',
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
