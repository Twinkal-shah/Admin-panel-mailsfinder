import dayjs from 'dayjs'
import { Purchase, User } from '../types/types'

export interface DateRange {
  from: string
  to: string
}

export function inRange(dateIso: string, range: DateRange): boolean {
  const d = dayjs(dateIso)
  return d.isAfter(dayjs(range.from)) && d.isBefore(dayjs(range.to))
}

export function totalUsers(users: User[], range?: DateRange): number {
  if (!range) return users.length
  return users.filter(u => inRange(u.createdAt, range)).length
}

export function activeSubscriptions(users: User[], range?: DateRange): number {
  const set = range ? users.filter(u => inRange(u.createdAt, range)) : users
  return set.filter(u => u.subscription_status === 'active').length
}

export function totalCreditsUsed(users: User[], range?: DateRange): number {
  const set = range ? users.filter(u => inRange(u.createdAt, range)) : users
  return set.reduce((acc, u) => acc + (u.credits_find + u.credits_verify), 0)
}

export function totalRevenue(purchases: Purchase[], range?: DateRange): number {
  const set = range ? purchases.filter(p => inRange(p.date, range)) : purchases
  return set.filter(p => p.status === 'paid').reduce((acc, p) => acc + p.amount, 0)
}

export function newUsersMoM(users: User[], currentRange: DateRange, previousRange: DateRange): { current: number; previous: number; deltaPct: number } {
  const current = users.filter(u => inRange(u.createdAt, currentRange)).length
  const previous = users.filter(u => inRange(u.createdAt, previousRange)).length
  const deltaPct = previous === 0 ? 100 : ((current - previous) / previous) * 100
  return { current, previous, deltaPct }
}

export function churnRate(users: User[], range: DateRange): number {
  const periodUsers = users.filter(u => inRange(u.createdAt, range))
  const periodStartUsers = periodUsers.length
  const cancelled = periodUsers.filter(u => u.subscription_status === 'cancelled').length
  if (periodStartUsers === 0) return 0
  return (cancelled / periodStartUsers) * 100
}

export function activeUsersLast30(users: User[]): number {
  const now = dayjs()
  const from = now.subtract(30, 'day').toISOString()
  const to = now.toISOString()
  return users.filter(u => u.lastSeen && inRange(u.lastSeen, { from, to })).length
}
