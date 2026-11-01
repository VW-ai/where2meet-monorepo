'use client';

import { useEffect } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { Wine, Dumbbell, Coffee, Sparkles } from 'lucide-react';
import { useUIStore, type CategoryFilter } from '@/features/meeting/model/ui-store';
import { useAuthStore } from '@/features/auth/model/auth-store';
import { cn } from '@/shared/lib/cn';
import { defineMessages, useMessages } from '@/shared/lib/i18n';

const CATEGORY_FILTERS = [
  { id: 'bar' as const, icon: Wine },
  { id: 'gym' as const, icon: Dumbbell },
  { id: 'cafe' as const, icon: Coffee },
  { id: 'things_to_do' as const, icon: Sparkles },
];

type CategoryId = (typeof CATEGORY_FILTERS)[number]['id'];

const messages = defineMessages<{ labels: Record<CategoryId, string>; joinToSearch: string }>({
  en: {
    labels: { bar: 'Bar', gym: 'Gym', cafe: 'Cafe', things_to_do: 'Things to do' },
    joinToSearch: 'Join the event to search for venues',
  },
  zh: {
    labels: { bar: '酒吧', gym: '健身房', cafe: '咖啡馆', things_to_do: '好玩的' },
    joinToSearch: '加入见面后才能搜索地点',
  },
});

export function FilterPills() {
  const t = useMessages(messages);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const {
    selectedCategory,
    setSelectedCategory,
    setSearchQuery,
    setActiveView,
    triggerSearchExecution,
  } = useUIStore();
  const { isOrganizerMode, isParticipantMode } = useAuthStore();

  // Check if user has joined (organizer or participant)
  const hasJoined = isOrganizerMode || isParticipantMode;

  // Sync URL params with store on mount
  useEffect(() => {
    const categoryParam = searchParams.get('category') as CategoryFilter;
    if (categoryParam && CATEGORY_FILTERS.some((f) => f.id === categoryParam)) {
      setSelectedCategory(categoryParam);
    }
  }, [searchParams, setSelectedCategory]);

  const handleCategoryClick = (category: CategoryFilter) => {
    // Only allow search if user has joined
    if (!hasJoined) return;

    // Get the category label for the search query
    const categoryFilter = CATEGORY_FILTERS.find((f) => f.id === category);
    const categoryLabel = categoryFilter ? t.labels[categoryFilter.id] : '';

    // Set the search query to the category label (e.g., "Bar", "Gym", "Cafe")
    setSearchQuery(categoryLabel);

    // Trigger search execution
    setActiveView('venue');
    triggerSearchExecution();

    // Clear the selected category immediately after triggering search
    // This prevents the button from staying red
    setTimeout(() => {
      setSelectedCategory(null);
    }, 100);

    // Update URL query params
    const params = new URLSearchParams(searchParams.toString());
    params.delete('category'); // Don't persist category in URL
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  };

  return (
    <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar max-w-full py-1 px-1">
      {CATEGORY_FILTERS.map(({ id, icon: Icon }) => (
        <button
          key={id}
          onClick={() => handleCategoryClick(id)}
          disabled={!hasJoined}
          className={cn(
            'flex items-center gap-1.5 sm:gap-2 rounded-full text-sm font-medium transition-all duration-200 whitespace-nowrap flex-shrink-0',
            'px-3 py-2 touch-target',
            'focus:outline-none focus:ring-2 focus:ring-coral-500',
            !hasJoined &&
              'opacity-50 cursor-not-allowed bg-gray-100 text-gray-400 border-2 border-gray-200',
            hasJoined &&
              (selectedCategory === id
                ? 'bg-coral-500 text-white shadow-md border-2 border-coral-500'
                : 'bg-white text-foreground border-2 border-border hover:border-coral-500 hover:bg-coral-50')
          )}
          title={!hasJoined ? t.joinToSearch : undefined}
        >
          <Icon className="w-5 h-5" />
          <span className="hidden sm:inline">{t.labels[id]}</span>
        </button>
      ))}
    </div>
  );
}
