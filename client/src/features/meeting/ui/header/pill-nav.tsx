'use client';

import { useEffect } from 'react';
import Image from 'next/image';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { Building2, Users, type LucideIcon } from 'lucide-react';
import { useUIStore, type ActiveView } from '@/features/meeting/model/ui-store';
import { cn } from '@/shared/lib/cn';
import catLogo from '@/components/cat/logo.svg';
import { ParticipantIconFlash } from './participant-icon-flash';
import { defineMessages, useMessages } from '@/shared/lib/i18n';

const messages = defineMessages({
  en: {
    home: 'Home',
    logoAlt: 'Where2Meet Cat Logo',
    venues: 'Venues',
    participants: 'Participants',
  },
  zh: { home: '首页', logoAlt: 'Where2Meet 猫咪标志', venues: '地点', participants: '参与者' },
});

// Shared NavButton component
interface NavButtonProps {
  onClick: () => void;
  isActive: boolean;
  isSidebarVisible: boolean;
  icon: LucideIcon;
  label: string;
  shouldFlash?: boolean;
  onFlashComplete?: () => void;
}

function NavButton({
  onClick,
  isActive,
  isSidebarVisible,
  icon: Icon,
  label,
  shouldFlash,
  onFlashComplete,
}: NavButtonProps) {
  const content = shouldFlash ? (
    <ParticipantIconFlash shouldFlash={shouldFlash} onFlashComplete={onFlashComplete || (() => {})}>
      <Icon className="w-5 h-5" />
    </ParticipantIconFlash>
  ) : (
    <Icon className="w-5 h-5" />
  );

  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-2 rounded-full text-sm font-medium transition-all duration-200',
        'px-3 py-2 touch-target md:px-4',
        isActive && isSidebarVisible
          ? 'bg-coral-500 text-white shadow-sm'
          : 'bg-white text-foreground border-2 border-border hover:border-coral-500 hover:bg-coral-50',
        'focus:outline-none focus:ring-2 focus:ring-coral-500 focus:ring-offset-2'
      )}
      aria-label={label}
    >
      {content}
      <span className="hidden md:inline">{label}</span>
    </button>
  );
}

export function PillNav() {
  const t = useMessages(messages);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const {
    activeView,
    setActiveView,
    isSidebarVisible,
    toggleSidebar,
    showSidebar,
    shouldFlashParticipantIcon,
    resetParticipantFlash,
  } = useUIStore();

  // Sync URL params with store on mount
  useEffect(() => {
    const viewParam = searchParams.get('view') as ActiveView;
    if (viewParam === 'participant' || viewParam === 'venue') {
      setActiveView(viewParam);
    }
  }, [searchParams, setActiveView]);

  const handleViewChange = (view: ActiveView) => {
    // If clicking on the same view that's already active and sidebar is visible, toggle it
    if (activeView === view && isSidebarVisible) {
      toggleSidebar();
    } else {
      // Otherwise, set the view and ensure sidebar is visible
      setActiveView(view);
      showSidebar();

      // Update URL query params
      const params = new URLSearchParams(searchParams.toString());
      params.set('view', view);
      router.push(`${pathname}?${params.toString()}`, { scroll: false });
    }
  };

  return (
    <div className="flex items-center gap-1 md:gap-2" data-tutorial="view-toggle">
      {/* Home Button (Logo) */}
      <button
        onClick={() => router.push('/')}
        className="p-2 rounded-full bg-white border-2 border-border hover:border-coral-500 hover:bg-coral-50 transition-all duration-200 touch-target focus:outline-none focus:ring-2 focus:ring-coral-500 focus:ring-offset-2"
        aria-label={t.home}
      >
        <Image
          src={catLogo}
          alt={t.logoAlt}
          width={32}
          height={32}
          className="w-6 h-6 md:w-8 md:h-8"
          priority
        />
      </button>

      {/* Venue Button */}
      <NavButton
        onClick={() => handleViewChange('venue')}
        isActive={activeView === 'venue'}
        isSidebarVisible={isSidebarVisible}
        icon={Building2}
        label={t.venues}
      />

      {/* Participants Button */}
      <NavButton
        onClick={() => handleViewChange('participant')}
        isActive={activeView === 'participant'}
        isSidebarVisible={isSidebarVisible}
        icon={Users}
        label={t.participants}
        shouldFlash={shouldFlashParticipantIcon}
        onFlashComplete={resetParticipantFlash}
      />
    </div>
  );
}
