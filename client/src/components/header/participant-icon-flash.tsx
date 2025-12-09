'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils/cn';

interface ParticipantIconFlashProps {
  children: React.ReactNode;
  shouldFlash: boolean;
  onFlashComplete: () => void;
}

/**
 * Wrapper component that adds a 3-pulse flash animation to its children
 * Animation: 3 pulses over 600ms (200ms per pulse)
 * Triggered when shouldFlash changes to true
 */
export function ParticipantIconFlash({
  children,
  shouldFlash,
  onFlashComplete,
}: ParticipantIconFlashProps) {
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (shouldFlash) {
      setIsAnimating(true);

      // Reset animation after 600ms (3 pulses × 200ms)
      const timeout = setTimeout(() => {
        setIsAnimating(false);
        onFlashComplete();
      }, 600);

      return () => clearTimeout(timeout);
    }
  }, [shouldFlash, onFlashComplete]);

  return (
    <div
      className={cn(
        'inline-flex items-center justify-center',
        isAnimating && 'animate-flash-pulse'
      )}
    >
      {children}
    </div>
  );
}
