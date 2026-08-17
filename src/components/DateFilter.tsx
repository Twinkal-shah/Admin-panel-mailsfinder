import { DatePicker, Segmented, Typography } from 'antd'
import { CalendarOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
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
    const now = dayjs.utc()
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

  function onRangeChange(range: any) {
    if (!range || !range[0] || !range[1]) return
    const fromLocal = range[0]
    const toLocal = range[1]
    const fromIso = dayjs.utc(new Date(Date.UTC(fromLocal.year(), fromLocal.month(), fromLocal.date(), 0, 0, 0))).toISOString()
    const toIso = dayjs.utc(new Date(Date.UTC(toLocal.year(), toLocal.month(), toLocal.date(), 23, 59, 59))).toISOString()
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
        value={[dayjs(props.value.from), dayjs(props.value.to)]}
        onChange={onRangeChange}
        allowClear={false}
      />
    </div>
  )
}
