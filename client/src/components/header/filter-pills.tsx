'use client';

import { useEffect } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { Wine, Dumbbell, Coffee, Sparkles } from 'lucide-react';
import { useUIStore, type CategoryFilter } from '@/store/ui-store';
import { cn } from '@/lib/utils/cn';

const CATEGORY_FILTERS = [
  { id: 'bar' as const, label: 'Bar', icon: Wine },
  { id: 'gym' as const, label: 'Gym', icon: Dumbbell },
  { id: 'cafe' as const, label: 'Cafe', icon: Coffee },
  { id: 'things_to_do' as const, label: 'Things to do', icon: Sparkles },
];

export function FilterPills() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { selectedCategory, setSelectedCategory } = useUIStore();

  // Sync URL params with store on mount
  useEffect(() => {
    const categoryParam = searchParams.get('category') as CategoryFilter;
    if (categoryParam && CATEGORY_FILTERS.some((f) => f.id === categoryParam)) {
      setSelectedCategory(categoryParam);
    }
  }, [searchParams, setSelectedCategory]);

  const handleCategoryClick = (category: CategoryFilter) => {
    const newCategory = selectedCategory === category ? null : category;
    setSelectedCategory(newCategory);

    // Update URL query params
    const params = new URLSearchParams(searchParams.toString());
    if (newCategory) {
      params.set('category', newCategory);
    } else {
      params.delete('category');
    }

    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  };

  return (
    <div className="flex items-center gap-2 overflow-x-auto no-scrollbar max-w-full py-1 px-1">
      {CATEGORY_FILTERS.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          onClick={() => handleCategoryClick(id)}
          className={cn(
            'flex items-center gap-2 px-3 md:px-4 py-2 md:py-2 rounded-full text-sm font-medium transition-all duration-200 whitespace-nowrap flex-shrink-0 focus:outline-none focus:ring-2 focus:ring-coral-500',
            selectedCategory === id
              ? 'bg-coral-500 text-white shadow-md border-2 border-coral-500'
              : 'bg-white text-foreground border-2 border-border hover:border-coral-500 hover:bg-coral-50'
          )}
        >
          <Icon className="w-5 h-5" />
          <span className="hidden md:inline">{label}</span>
        </button>
      ))}
    </div>
  );
}
