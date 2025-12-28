'use client';

import { Clock } from 'lucide-react';
import { cn } from '@/shared/lib/cn';

interface TravelTimeBubbleProps {
  travelTime: string;
  isVisible: boolean;
  className?: string;
}

export function TravelTimeBubble({ travelTime, isVisible, className }: TravelTimeBubbleProps) {
  if (!isVisible) return null;

  return (
    <div className={cn('relative animate-in fade-in slide-in-from-left-2 duration-200', className)}>
      <div className="relative">
        {/* Connector triangle pointing left */}
        <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-full">
          <div className="w-0 h-0 border-t-[6px] border-t-transparent border-b-[6px] border-b-transparent border-r-[8px] border-r-coral-500" />
        </div>

        {/* Bubble content */}
        <div className="bg-coral-500 text-white px-3 py-1.5 rounded-full shadow-lg whitespace-nowrap flex items-center gap-1.5">
          <Clock className="w-3 h-3" />
          <span className="text-xs font-medium">{travelTime}</span>
        </div>
      </div>
    </div>
  );
}
