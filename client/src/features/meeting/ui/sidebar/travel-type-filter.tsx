'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { Car, Bus, PersonStanding, Bike } from 'lucide-react';
import { useMapStore, type UITravelMode } from '@/features/meeting/model/map-store';
import { cn } from '@/shared/lib/cn';
import { defineMessages, useMessages } from '@/shared/lib/i18n';

const messages = defineMessages({
  en: {
    modes: { car: 'Car', transit: 'Transit', walk: 'Walk', bike: 'Bike' } as Record<
      UITravelMode,
      string
    >,
    travelBy: (label: string) => `Travel by ${label}`,
  },
  zh: {
    modes: { car: '驾车', transit: '公交', walk: '步行', bike: '骑行' },
    travelBy: (label: string) => `${label}出行`,
  },
});

const travelModes = [
  { value: 'car' as const, icon: Car },
  { value: 'transit' as const, icon: Bus },
  { value: 'walk' as const, icon: PersonStanding },
  { value: 'bike' as const, icon: Bike },
];

export function TravelTypeFilter() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { travelMode, setTravelMode } = useMapStore();
  const t = useMessages(messages);

  // Sync URL params with store on mount
  useEffect(() => {
    const modeParam = searchParams.get('travelMode') as UITravelMode;
    if (modeParam && ['car', 'transit', 'walk', 'bike'].includes(modeParam)) {
      setTravelMode(modeParam);
    }
  }, [searchParams, setTravelMode]);

  const handleModeChange = (mode: UITravelMode) => {
    // Update store (this will also trigger the flash)
    setTravelMode(mode);

    // Update URL params
    const params = new URLSearchParams(searchParams.toString());
    params.set('travelMode', mode);
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  };

  return (
    <div className="flex items-center gap-1.5 md:gap-2">
      {travelModes.map(({ value, icon: Icon }) => {
        const label = t.modes[value];
        const isActive = travelMode === value;
        return (
          <button
            key={value}
            onClick={() => handleModeChange(value)}
            className={cn(
              'flex-1 flex items-center justify-center gap-1.5 px-2 xl:px-3 py-2 rounded-lg xl:rounded-xl text-xs font-medium transition-all duration-200',
              'focus:outline-none focus:ring-2 focus:ring-coral-500/20',
              'min-w-0', // Allow buttons to shrink below their content size
              isActive
                ? 'bg-coral-500 text-white shadow-lg'
                : 'bg-white/90 backdrop-blur-sm text-foreground border-2 border-border hover:border-coral-500 hover:bg-coral-50 shadow-md hover:shadow-lg'
            )}
            aria-pressed={isActive}
            aria-label={t.travelBy(label)}
          >
            <Icon className="w-4 h-4 flex-shrink-0" />
            <span className="hidden xl:inline text-sm whitespace-nowrap">{label}</span>
          </button>
        );
      })}
    </div>
  );
}
