'use client';

import { ReactNode, useState } from 'react';
import { cn } from '@/shared/lib/cn';

interface TooltipProps {
  content: string | ReactNode;
  children: ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
  className?: string;
}

export function Tooltip({ content, children, position = 'top', className }: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);

  const positionClasses = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  };

  const arrowClasses = {
    top: 'top-full left-1/2 -translate-x-1/2 border-l-transparent border-r-transparent border-b-transparent border-t-gray-900',
    bottom:
      'bottom-full left-1/2 -translate-x-1/2 border-l-transparent border-r-transparent border-t-transparent border-b-gray-900',
    left: 'left-full top-1/2 -translate-y-1/2 border-t-transparent border-b-transparent border-r-transparent border-l-gray-900',
    right:
      'right-full top-1/2 -translate-y-1/2 border-t-transparent border-b-transparent border-l-transparent border-r-gray-900',
  };

  return (
    <div className="relative inline-block">
      <div
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
        onClick={() => setIsVisible(!isVisible)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            setIsVisible(!isVisible);
          }
        }}
        role="button"
        tabIndex={0}
        aria-label="Show tooltip"
      >
        {children}
      </div>

      {isVisible && (
        <div
          className={cn(
            'absolute z-50 px-3 py-2 text-xs text-white bg-gray-900 rounded-lg shadow-lg',
            'max-w-xs whitespace-normal',
            'animate-in fade-in-0 zoom-in-95 duration-200',
            positionClasses[position],
            className
          )}
        >
          {content}
          {/* Arrow */}
          <div className={cn('absolute w-0 h-0 border-4', arrowClasses[position])} />
        </div>
      )}
    </div>
  );
}
