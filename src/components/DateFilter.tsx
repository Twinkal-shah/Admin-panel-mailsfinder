import { DatePicker, Segmented, Typography } from 'antd'
import { CalendarOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import { REPORT_TZ_OFFSET_MINUTES, inReportTz, nowInReportTz } from '../utils/reportingTz'
dayjs.extend(utc)

export type DatePreset = 'Today' | 'Yesterday' | 'Last 7 Days' | 'Last 30 Days' | 'Custom Range'
export interface DateRange {
  from: string
  to: string
  preset: DatePreset
}

const PRESETS: DatePreset[] = ['Today', 'Yesterday', 'Last 7 Days', 'Last 30 Days', 'Custom Range']

/** Compact labels so the segmented control fits on narrow screens. */
const SHORT_LABEL: Record<DatePreset, string> = {
  Today: 'Today',
  Yesterday: 'Yesterday',
  'Last 7 Days': '7D',
  'Last 30 Days': '30D',
  'Custom Range': 'Custom'
}

export default function DateFilter(props: {
  value: DateRange
  onChange: (range: DateRange) => void
}) {
  const { RangePicker } = DatePicker

  function computeRange(preset: DatePreset): DateRange {
    // Day boundaries are resolved in the reporting timezone (IST), not UTC, so
    // "Today" means 00:00–23:59 IST. Previously this was `dayjs.utc()`, which
    // pushed the first 5h30m of the IST day into the previous bucket.
    const now = nowInReportTz()
    switch (preset) {
      case 'Today':
        return { from: now.startOf('day').toISOString(), to: now.endOf('day').toISOString(), preset }
      case 'Yesterday': {
        const yesterday = now.subtract(1, 'day')
        return { from: yesterday.startOf('day').toISOString(), to: yesterday.endOf('day').toISOString(), preset }
      }
      case 'Last 7 Days':
        return { from: now.subtract(6, 'day').startOf('day').toISOString(), to: now.endOf('day').toISOString(), preset }
      case 'Last 30 Days':
        return { from: now.subtract(29, 'day').startOf('day').toISOString(), to: now.endOf('day').toISOString(), preset }
      default:
        return props.value
    }
  }

  function onPresetChange(val: DatePreset) {
    if (val === 'Custom Range') {
      props.onChange({ ...props.value, preset: val })
    } else {
      props.onChange(computeRange(val))
    }
  }

  /** Re-reads the calendar date the user clicked as a day in the reporting tz. */
  function asReportTzDay(picked: any) {
    return nowInReportTz().year(picked.year()).month(picked.month()).date(picked.date())
  }

  function onRangeChange(range: any) {
    if (!range || !range[0] || !range[1]) return
    // Same change as the presets: expand the picked dates into IST day bounds
    // instead of UTC ones.
    const fromIso = asReportTzDay(range[0]).startOf('day').toISOString()
    const toIso = asReportTzDay(range[1]).endOf('day').toISOString()
    props.onChange({
      from: fromIso,
      to: toIso,
      preset: 'Custom Range'
    })
  }

  return (
    <div className="mf-datefilter">
      <div className="mf-datefilter__label">
        <CalendarOutlined />
        <Typography.Text type="secondary">Period</Typography.Text>
      </div>
      <Segmented
        className="mf-datefilter__segmented"
        options={PRESETS.map(p => ({ label: SHORT_LABEL[p], value: p }))}
        value={props.value.preset}
        onChange={(val) => onPresetChange(val as DatePreset)}
      />
      <RangePicker
        className="mf-datefilter__picker"
        value={[inReportTz(props.value.from), inReportTz(props.value.to)]}
        onChange={onRangeChange}
        allowClear={false}
      />
    </div>
  )
}
