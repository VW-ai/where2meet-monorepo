'use client';

import { useEffect } from 'react';
import Image from 'next/image';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { Building2, Users } from 'lucide-react';
import { useUIStore, type ActiveView } from '@/store/ui-store';
import { cn } from '@/lib/utils/cn';
import catLogo from '@/components/cat/image.png';

export function PillNav() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { activeView, setActiveView } = useUIStore();

  // Sync URL params with store on mount
  useEffect(() => {
    const viewParam = searchParams.get('view') as ActiveView;
    if (viewParam === 'participant' || viewParam === 'venue') {
      setActiveView(viewParam);
    }
  }, [searchParams, setActiveView]);

  const handleViewChange = (view: ActiveView) => {
    setActiveView(view);

    // Update URL query params
    const params = new URLSearchParams(searchParams.toString());
    params.set('view', view);
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  };

  return (
    <div className="flex items-center justify-between w-full">
      {/* Navigation Buttons */}
      <div className="hidden sm:flex items-center gap-1 md:gap-2">
        {/* Home Button (Logo) */}
        <button
          onClick={() => router.push('/')}
          className="p-2 md:p-2 rounded-full bg-white border-2 border-border hover:border-coral-500 hover:bg-coral-50 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-coral-500 focus:ring-offset-2"
          aria-label="Home"
        >
          <Image
            src={catLogo}
            alt="Where2Meet Cat Logo"
            width={32}
            height={32}
            className="w-6 h-6 md:w-8 md:h-8"
            priority
          />
        </button>
        {/* Venue Button */}
        <button
          onClick={() => handleViewChange('venue')}
          className={cn(
            'flex items-center gap-2 px-3 md:px-4 py-2 md:py-2 rounded-full text-sm font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-coral-500 focus:ring-offset-2',
            activeView === 'venue'
              ? 'bg-coral-500 text-white shadow-sm'
              : 'bg-white text-foreground border-2 border-border hover:border-coral-500 hover:bg-coral-50'
          )}
        >
          <Building2 className="w-5 h-5" />
          <span className="hidden md:inline">Venues</span>
        </button>

        {/* Participants Button */}
        <button
          onClick={() => handleViewChange('participant')}
          className={cn(
            'flex items-center gap-2 px-3 md:px-4 py-2 md:py-2 rounded-full text-sm font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-coral-500 focus:ring-offset-2',
            activeView === 'participant'
              ? 'bg-coral-500 text-white shadow-sm'
              : 'bg-white text-foreground border-2 border-border hover:border-coral-500 hover:bg-coral-50'
          )}
        >
          <Users className="w-5 h-5" />
          <span className="hidden md:inline">Participants</span>
        </button>
      </div>

      {/* Mobile Navigation (Icons Only) */}
      <div className="flex sm:hidden items-center gap-1">
        {/* Home Button (Logo) */}
        <button
          onClick={() => router.push('/')}
          className="p-2 rounded-full bg-white border border-border hover:border-coral-500 hover:bg-coral-50 transition-all duration-200 min-w-[44px] min-h-[44px] focus:outline-none focus:ring-2 focus:ring-coral-500 focus:ring-offset-2"
          aria-label="Home"
        >
          <Image
            src={catLogo}
            alt="Where2Meet Cat Logo"
            width={24}
            height={24}
            className="w-6 h-6"
            priority
          />
        </button>

        <button
          onClick={() => handleViewChange('venue')}
          className={cn(
            'p-3 rounded-full transition-all duration-200 min-w-[44px] min-h-[44px] focus:outline-none focus:ring-2 focus:ring-coral-500 focus:ring-offset-2',
            activeView === 'venue'
              ? 'bg-coral-500 text-white'
              : 'bg-white text-muted-foreground border border-border'
          )}
          aria-label="Venues"
        >
          <Building2 className="w-5 h-5" />
        </button>

        <button
          onClick={() => handleViewChange('participant')}
          className={cn(
            'p-3 rounded-full transition-all duration-200 min-w-[44px] min-h-[44px] focus:outline-none focus:ring-2 focus:ring-coral-500 focus:ring-offset-2',
            activeView === 'participant'
              ? 'bg-coral-500 text-white'
              : 'bg-white text-muted-foreground border border-border'
          )}
          aria-label="Participants"
        >
          <Users className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
