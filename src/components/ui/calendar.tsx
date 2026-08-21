import { ChevronLeft, ChevronRight } from 'lucide-react'
import { DayPicker } from 'react-day-picker'

import { cn } from '@/lib/utils'
import { buttonVariants } from '@/components/ui/button'

/**
 * Calendar primitive (react-day-picker v9). Not in the starter kit.
 *
 * Every colour is a token, so it is correct in both themes with no JS
 * branching. `--primary` marks the selected range endpoints and `--accent`
 * the days between them.
 */
function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: React.ComponentProps<typeof DayPicker>) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn('p-3', className)}
      classNames={{
        months: 'flex flex-col sm:flex-row gap-4',
        month: 'flex flex-col gap-4',
        month_caption: 'flex justify-center pt-1 relative items-center h-7',
        caption_label: 'text-sm font-medium',
        nav: 'flex items-center gap-1',
        button_previous: cn(
          buttonVariants({ variant: 'ghost', size: 'icon-sm' }),
          'absolute left-1 top-0 z-10'
        ),
        button_next: cn(
          buttonVariants({ variant: 'ghost', size: 'icon-sm' }),
          'absolute right-1 top-0 z-10'
        ),
        month_grid: 'w-full border-collapse space-y-1',
        weekdays: 'flex',
        weekday: 'w-8 rounded-md text-[0.7rem] font-normal text-muted-foreground',
        week: 'flex w-full mt-1.5',
        day: 'relative size-8 p-0 text-center text-sm focus-within:relative focus-within:z-20',
        day_button: cn(
          buttonVariants({ variant: 'ghost' }),
          'size-8 p-0 font-normal aria-selected:opacity-100'
        ),
        range_start:
          'rounded-l-md bg-primary [&>button]:bg-primary [&>button]:text-primary-foreground [&>button]:hover:bg-primary',
        range_end:
          'rounded-r-md bg-primary [&>button]:bg-primary [&>button]:text-primary-foreground [&>button]:hover:bg-primary',
        range_middle: 'bg-accent [&>button]:bg-transparent [&>button]:text-accent-foreground',
        selected: '[&>button]:bg-primary [&>button]:text-primary-foreground',
        today: '[&>button]:font-semibold [&>button]:text-primary',
        outside: 'text-muted-foreground/50',
        disabled: 'text-muted-foreground/40 opacity-50',
        hidden: 'invisible',
        ...classNames
      }}
      components={{
        Chevron: ({ orientation, ...rest }) =>
          orientation === 'left' ? (
            <ChevronLeft className="size-4" {...rest} />
          ) : (
            <ChevronRight className="size-4" {...rest} />
          )
      }}
      {...props}
    />
  )
}

export { Calendar }
