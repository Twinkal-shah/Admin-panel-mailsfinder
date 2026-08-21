import dayjs, { Dayjs } from 'dayjs'
import utc from 'dayjs/plugin/utc'

// Extended here too (main.tsx also does it) so these helpers are safe to use
// from modules that may evaluate before the app entry point.
dayjs.extend(utc)

/**
 * Reporting timezone for the admin dashboard's date ranges.
 *
 * The dashboard used to build ranges as UTC days while the Users page rendered
 * `createdAt` in browser-local time. For an IST viewer that hid every signup
 * between 00:00 and 05:29 IST from "Today" — those instants fall on the
 * previous UTC date. Ranges are now IST days on both sides of the API.
 *
 * IST (Asia/Kolkata) has had no DST since 1945, so a fixed offset is exact and
 * needs no timezone database.
 *
 * Must stay in sync with `REPORT_TZ` in the backend's
 * `core/src/modules/admin/services/admin.dashboard.service.ts`.
 */
export const REPORT_TZ_OFFSET_MINUTES = 330

/** `now`, read in the reporting timezone. */
export function nowInReportTz(): Dayjs {
  return dayjs().utcOffset(REPORT_TZ_OFFSET_MINUTES)
}

/** An instant, read in the reporting timezone. */
export function inReportTz(iso: string): Dayjs {
  return dayjs(iso).utcOffset(REPORT_TZ_OFFSET_MINUTES)
}

/**
 * The calendar date an instant falls on in the reporting timezone. This is the
 * `YYYY-MM-DD` the API is given.
 */
export function reportTzDate(iso: string): string {
  return inReportTz(iso).format('YYYY-MM-DD')
}

/** First instant of the given reporting-tz calendar date. */
export function reportTzDayStart(ymd: string): Date {
  return dayjs
    .utc(`${ymd}T00:00:00.000`)
    .subtract(REPORT_TZ_OFFSET_MINUTES, 'minute')
    .toDate()
}

/** Last instant (…:59.999) of the given reporting-tz calendar date. */
export function reportTzDayEnd(ymd: string): Date {
  return dayjs
    .utc(`${ymd}T23:59:59.999`)
    .subtract(REPORT_TZ_OFFSET_MINUTES, 'minute')
    .toDate()
}
