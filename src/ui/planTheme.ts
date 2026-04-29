export type PlanId = 'free' | 'monthly' | 'lifetime' | 'payg'

export const PLAN_ORDER: PlanId[] = ['free', 'monthly', 'lifetime', 'payg']

export const PLAN_COLORS: Record<PlanId, string> = {
  free: '#94A3B8',
  monthly: '#3B82F6',
  lifetime: '#F59E0B',
  payg: '#8B5CF6'
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
