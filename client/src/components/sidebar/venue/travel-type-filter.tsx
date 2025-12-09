'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { Car, Bus, PersonStanding, Bike } from 'lucide-react';
import { useUIStore, type TravelMode } from '@/store/ui-store';
import { cn } from '@/lib/utils/cn';

const travelModes = [
  { value: 'car' as const, label: 'Car', icon: Car },
  { value: 'transit' as const, label: 'Transit', icon: Bus },
  { value: 'walk' as const, label: 'Walk', icon: PersonStanding },
  { value: 'bike' as const, label: 'Bike', icon: Bike },
];

export function TravelTypeFilter() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { selectedTravelMode, setTravelMode } = useUIStore();

  // Sync URL params with store on mount
  useEffect(() => {
    const modeParam = searchParams.get('travelMode') as TravelMode;
    if (modeParam && ['car', 'transit', 'walk', 'bike'].includes(modeParam)) {
      setTravelMode(modeParam);
    }
  }, [searchParams, setTravelMode]);

  const handleModeChange = (mode: TravelMode) => {
    // Update store (this will also trigger the flash)
    setTravelMode(mode);

    // Update URL params
    const params = new URLSearchParams(searchParams.toString());
    params.set('travelMode', mode);
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  };

  return (
    <div className="flex items-center gap-1.5 md:gap-2">
      {travelModes.map(({ value, label, icon: Icon }) => {
        const isActive = selectedTravelMode === value;
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
            aria-label={`Travel by ${label}`}
          >
            <Icon className="w-4 h-4 flex-shrink-0" />
            <span className="hidden xl:inline text-sm whitespace-nowrap">{label}</span>
          </button>
        );
      })}
    </div>
  );
}
