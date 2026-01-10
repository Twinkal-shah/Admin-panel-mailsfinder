import { DatePicker, Segmented } from 'antd'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
dayjs.extend(utc)

export type DatePreset = 'Today' | '7d' | '30d' | 'This month' | 'Custom range'
export interface DateRange {
  from: string
  to: string
  preset: DatePreset
}

export default function DateFilter(props: {
  value: DateRange
  onChange: (range: DateRange) => void
}) {
  const { RangePicker } = DatePicker

  const presets: DatePreset[] = ['Today', '7d', '30d', 'This month', 'Custom range']

  function computeRange(preset: DatePreset): DateRange {
    const now = dayjs.utc()
    switch (preset) {
      case 'Today':
        return { from: now.startOf('day').toISOString(), to: now.endOf('day').toISOString(), preset }
      case '7d':
        return { from: now.subtract(7, 'day').startOf('day').toISOString(), to: now.endOf('day').toISOString(), preset }
      case '30d':
        return { from: now.subtract(30, 'day').startOf('day').toISOString(), to: now.endOf('day').toISOString(), preset }
      case 'This month':
        return { from: now.startOf('month').toISOString(), to: now.endOf('month').toISOString(), preset }
      default:
        return props.value
    }
  }

  function onPresetChange(val: DatePreset) {
    if (val === 'Custom range') {
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
      preset: 'Custom range'
    })
  }

  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', width: '100%' }}>
      <Segmented
        options={presets}
        value={props.value.preset}
        onChange={(val) => onPresetChange(val as DatePreset)}
      />
      <RangePicker
        value={[dayjs(props.value.from), dayjs(props.value.to)]}
        onChange={onRangeChange}
        style={{ minWidth: 240, flex: 1 }}
      />
    </div>
  )
}
