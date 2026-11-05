'use client';

import { cn } from '@/shared/lib/cn';
import { useMessages } from '@/shared/lib/i18n';
import type { TravelMode } from '@/shared/types/map';
import { PICKER_MODES } from './transport-parts';
import { travelModeMessages } from './travel-type-filter';

/** The small icon-only choice of mode, with no times: "You go by". */
export function ModeSegment({
  value,
  onChange,
}: {
  value: TravelMode;
  onChange: (mode: TravelMode) => void;
}) {
  const modeLabels = useMessages(travelModeMessages).modes;
  return (
    <div role="group" className="flex w-max items-center rounded-full bg-v2-wash p-0.5">
      {PICKER_MODES.map(({ mode, ui, icon: Icon }) => (
        <button
          key={mode}
          type="button"
          aria-pressed={value === mode}
          aria-label={modeLabels[ui]}
          title={modeLabels[ui]}
          onClick={() => onChange(mode)}
          className={cn(
            'grid h-[25px] w-[27px] place-items-center rounded-full [&_svg]:size-3.5',
            value === mode
              ? 'bg-white text-v2-ink shadow-[0_1px_2px_rgba(33,37,43,.14)]'
              : 'text-v2-ink-3'
          )}
        >
          <Icon aria-hidden="true" />
        </button>
      ))}
    </div>
  );
}
