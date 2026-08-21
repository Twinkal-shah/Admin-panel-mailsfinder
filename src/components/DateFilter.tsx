import { useState } from 'react'
import { Calendar as CalendarIcon } from 'lucide-react'
import type { DateRange as RdpRange } from 'react-day-picker'
import dayjs from 'dayjs'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

export type DatePreset = 'Today' | 'Yesterday' | 'Last 7 Days' | 'Last 30 Days' | 'Custom Range'
export interface DateRange {
  from: string
  to: string
  preset: DatePreset
}

const PRESETS: DatePreset[] = ['Today', 'Yesterday', 'Last 7 Days', 'Last 30 Days', 'Custom Range']

/** Compact labels so the control fits on narrow screens. */
const SHORT_LABEL: Record<DatePreset, string> = {
  Today: 'Today',
  Yesterday: 'Yesterday',
  'Last 7 Days': '7D',
  'Last 30 Days': '30D',
  'Custom Range': 'Custom'
}

/**
 * Period filter: a preset segmented control plus a custom range picker.
 *
 * The Antd `Segmented` became a button group and `DatePicker.RangePicker`
 * became Popover + Calendar, but `computeRange` and the UTC normalisation in
 * `onRangeSelect` are LOGIC and are carried over unchanged — the ISO strings
 * handed to the caller (and from there to the API) must stay byte-identical.
 *
 * dayjs's utc plugin is extended once at boot in main.tsx; the old version
 * re-extended it here for no reason.
 */
export default function DateFilter(props: {
  value: DateRange
  onChange: (range: DateRange) => void
}) {
  const [open, setOpen] = useState(false)

  function computeRange(preset: DatePreset): DateRange {
    const now = dayjs.utc()
    switch (preset) {
      case 'Today':
        return { from: now.startOf('day').toISOString(), to: now.endOf('day').toISOString(), preset }
      case 'Yesterday': {
        const yesterday = now.subtract(1, 'day')
        return {
          from: yesterday.startOf('day').toISOString(),
          to: yesterday.endOf('day').toISOString(),
          preset
        }
      }
      case 'Last 7 Days':
        return {
          from: now.subtract(6, 'day').startOf('day').toISOString(),
          to: now.endOf('day').toISOString(),
          preset
        }
      case 'Last 30 Days':
        return {
          from: now.subtract(29, 'day').startOf('day').toISOString(),
          to: now.endOf('day').toISOString(),
          preset
        }
      default:
        return props.value
    }
  }

  function onPresetChange(val: DatePreset) {
    if (val === 'Custom Range') {
      props.onChange({ ...props.value, preset: val })
      setOpen(true)
    } else {
      props.onChange(computeRange(val))
    }
  }

  /* Same UTC normalisation as before: the picker yields local Dates, and the
   * API expects a full UTC day span, so each endpoint is rebuilt from the
   * calendar Y/M/D rather than from the local instant. */
  function onRangeSelect(range: RdpRange | undefined) {
    if (!range?.from || !range?.to) return
    const f = range.from
    const t = range.to
    const fromIso = dayjs
      .utc(new Date(Date.UTC(f.getFullYear(), f.getMonth(), f.getDate(), 0, 0, 0)))
      .toISOString()
    const toIso = dayjs
      .utc(new Date(Date.UTC(t.getFullYear(), t.getMonth(), t.getDate(), 23, 59, 59)))
      .toISOString()
    props.onChange({ from: fromIso, to: toIso, preset: 'Custom Range' })
  }

  const selected: RdpRange = {
    from: dayjs(props.value.from).toDate(),
    to: dayjs(props.value.to).toDate()
  }

  const label = `${dayjs(props.value.from).format('MMM D, YYYY')} — ${dayjs(props.value.to).format('MMM D, YYYY')}`

  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <CalendarIcon className="size-4" />
        Period
      </span>

      {/* `radiogroup` + `radio` gives arrow-key semantics and announces which
          preset is selected, neither of which the Antd Segmented provided. */}
      <div
        role="radiogroup"
        aria-label="Period preset"
        className="flex items-center gap-1 rounded-lg bg-muted p-[3px]"
      >
        {PRESETS.map((p) => {
          const active = props.value.preset === p
          return (
            <button
              key={p}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onPresetChange(p)}
              className={cn(
                'rounded-md px-2 py-1 text-xs font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
                active
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {SHORT_LABEL[p]}
            </button>
          )
        })}
      </div>

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <Button variant="outline" size="sm" className="font-normal">
              <CalendarIcon />
              {label}
            </Button>
          }
        />
        <PopoverContent align="end" className="w-auto p-0">
          <Calendar
            mode="range"
            numberOfMonths={2}
            defaultMonth={selected.from}
            selected={selected}
            onSelect={onRangeSelect}
            autoFocus
          />
        </PopoverContent>
      </Popover>
    </div>
  )
}
