import { DatePicker, Segmented } from 'antd'
import dayjs from 'dayjs'

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
    const now = dayjs()
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
    props.onChange({
      from: range[0].startOf('day').toISOString(),
      to: range[1].endOf('day').toISOString(),
      preset: 'Custom range'
    })
  }

  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
      <Segmented
        options={presets}
        value={props.value.preset}
        onChange={(val) => onPresetChange(val as DatePreset)}
      />
      <RangePicker
        value={[dayjs(props.value.from), dayjs(props.value.to)]}
        onChange={onRangeChange}
      />
    </div>
  )
}
