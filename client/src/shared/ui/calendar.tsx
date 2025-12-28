'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import * as React from 'react';
import { DayPicker } from 'react-day-picker';

import { cn } from '@/shared/lib/cn';
import { buttonVariants } from '@/shared/ui/button';

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  components: userComponents,
  ...props
}: CalendarProps) {
  const defaultClassNames = {
    months: 'relative flex flex-col sm:flex-row gap-4',
    month: 'w-full',
    month_caption: 'relative mx-10 mb-1 flex h-9 items-center justify-center z-20',
    caption_label: 'text-sm font-medium',
    nav: 'absolute top-0 flex w-full justify-between z-10',
    button_previous: cn(
      buttonVariants({ variant: 'ghost' }),
      'size-9 text-gray-500 hover:text-gray-900 p-0'
    ),
    button_next: cn(
      buttonVariants({ variant: 'ghost' }),
      'size-9 text-gray-500 hover:text-gray-900 p-0'
    ),
    weekday: 'size-9 p-0 text-xs font-medium text-gray-500',
    day_button:
      'relative flex size-9 items-center justify-center whitespace-nowrap rounded-lg p-0 text-gray-900 outline-offset-2 group-[[data-selected]:not(.range-middle)]:[transition-property:color,background-color,border-radius,box-shadow] group-[[data-selected]:not(.range-middle)]:duration-150 focus:outline-none group-data-[disabled]:pointer-events-none focus-visible:z-10 hover:bg-gray-100 group-data-[selected]:bg-coral-500 hover:text-gray-900 group-data-[selected]:text-white group-data-[disabled]:text-gray-300 group-data-[disabled]:line-through group-data-[outside]:text-gray-300 group-data-[outside]:group-data-[selected]:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-coral-500/70 group-[.range-start:not(.range-end)]:rounded-e-none group-[.range-end:not(.range-start)]:rounded-s-none group-[.range-middle]:rounded-none group-data-[selected]:group-[.range-middle]:bg-coral-100 group-data-[selected]:group-[.range-middle]:text-gray-900',
    day: 'group size-9 px-0 text-sm',
    range_start: 'range-start',
    range_end: 'range-end',
    range_middle: 'range-middle',
    today:
      '*:after:pointer-events-none *:after:absolute *:after:bottom-1 *:after:start-1/2 *:after:z-10 *:after:size-[3px] *:after:-translate-x-1/2 *:after:rounded-full *:after:bg-coral-500 [&[data-selected]:not(.range-middle)>*]:after:bg-white [&[data-disabled]>*]:after:bg-gray-300 *:after:transition-colors',
    outside: 'text-gray-400 data-selected:bg-coral-100/50 data-selected:text-gray-900',
    hidden: 'invisible',
    week_number: 'size-9 p-0 text-xs font-medium text-gray-500',
  };

  const mergedClassNames: typeof defaultClassNames = Object.keys(defaultClassNames).reduce(
    (acc, key) => ({
      ...acc,
      [key]: classNames?.[key as keyof typeof classNames]
        ? cn(
            defaultClassNames[key as keyof typeof defaultClassNames],
            classNames[key as keyof typeof classNames]
          )
        : defaultClassNames[key as keyof typeof defaultClassNames],
    }),
    {} as typeof defaultClassNames
  );

  const defaultComponents = {
    Chevron: (props: { orientation?: string }) => {
      if (props.orientation === 'left') {
        return <ChevronLeft size={16} strokeWidth={2} {...props} aria-hidden="true" />;
      }
      return <ChevronRight size={16} strokeWidth={2} {...props} aria-hidden="true" />;
    },
  };

  const mergedComponents = {
    ...defaultComponents,
    ...userComponents,
  };

  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn('w-fit', className)}
      classNames={mergedClassNames}
      components={mergedComponents}
      {...props}
    />
  );
}
Calendar.displayName = 'Calendar';

export { Calendar };
