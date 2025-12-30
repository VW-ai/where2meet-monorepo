'use client';

import { useEffect, useState, useCallback } from 'react';
import { useTutorialStore } from '../model/tutorial-store';
import { TUTORIAL_STEPS } from '../config/steps';
import { calculatePopoverPosition } from '../lib/positioning';
import { TutorialStepCard } from './tutorial-step-card';
import { analyticsEvents } from '@/lib/analytics/events';
import { useParams } from 'next/navigation';

interface TutorialOverlayProps {
  currentStep: number;
}

export function TutorialOverlay({ currentStep }: TutorialOverlayProps) {
  const params = useParams();
  const eventId = params.id as string;
  const { skipTutorial } = useTutorialStore();
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [popoverPosition, setPopoverPosition] = useState<ReturnType<
    typeof calculatePopoverPosition
  > | null>(null);

  const stepConfig = TUTORIAL_STEPS[currentStep];

  // Find and track target element position
  const updateTargetPosition = useCallback(() => {
    if (!stepConfig) return;

    const targetElement = document.querySelector(stepConfig.targetSelector);
    if (targetElement) {
      const rect = targetElement.getBoundingClientRect();
      setTargetRect(rect);

      // Calculate popover position
      const position = calculatePopoverPosition(rect, stepConfig.placement);
      setPopoverPosition(position);
    }
  }, [stepConfig]);

  // Update position on mount and when step changes
  useEffect(() => {
    // Small delay to ensure DOM is ready
    const timer = setTimeout(updateTargetPosition, 100);
    return () => clearTimeout(timer);
  }, [currentStep, updateTargetPosition]);

  // Update position on window resize
  useEffect(() => {
    const handleResize = () => {
      updateTargetPosition();
    };

    const debouncedResize = debounce(handleResize, 300);
    window.addEventListener('resize', debouncedResize);
    return () => window.removeEventListener('resize', debouncedResize);
  }, [updateTargetPosition]);

  // Handle backdrop click to skip
  const handleBackdropClick = (e: React.MouseEvent) => {
    // Only skip if clicking the backdrop itself, not children
    if (e.target === e.currentTarget) {
      skipTutorial();
      analyticsEvents.tutorialSkipped(eventId, currentStep);
    }
  };

  if (!targetRect || !popoverPosition || !stepConfig) {
    return null;
  }

  // Responsive spotlight padding - ensure elements are fully visible
  const isMobile = window.innerWidth < 640;
  const responsivePadding = isMobile
    ? stepConfig.highlightPadding + 4 // Add extra padding on mobile for better visibility
    : stepConfig.highlightPadding;

  return (
    <>
      {/* Backdrop container */}
      <div
        className="fixed inset-0 pointer-events-auto"
        onClick={handleBackdropClick}
        aria-hidden="true"
      >
        {/* Spotlight cutout - creates dark overlay with transparent center */}
        <div
          className={`absolute transition-all duration-500 ease-out ${
            stepConfig.id === 'drag-search' ? 'rounded-full' : 'rounded-xl'
          }`}
          style={{
            top: targetRect.top - responsivePadding,
            left: targetRect.left - responsivePadding,
            width: targetRect.width + responsivePadding * 2,
            height: targetRect.height + responsivePadding * 2,
            boxShadow: `0 0 0 9999px rgba(0, 0, 0, ${isMobile ? '0.6' : '0.7'}), 0 0 0 4px rgba(255, 107, 107, 0.4)`,
            pointerEvents: 'none',
          }}
        />

        {/* Tutorial step card */}
        <TutorialStepCard step={currentStep} position={popoverPosition} eventId={eventId} />
      </div>
    </>
  );
}

// Debounce utility
function debounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}
