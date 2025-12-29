'use client';

import { useEffect } from 'react';
import { useTutorialStore } from '../model/tutorial-store';
import { TutorialOverlay } from './tutorial-overlay';
import { analyticsEvents } from '@/lib/analytics/events';
import { useParams } from 'next/navigation';

interface TutorialProviderProps {
  children: React.ReactNode;
}

export function TutorialProvider({ children }: TutorialProviderProps) {
  const params = useParams();
  const eventId = params.id as string;
  const { isTutorialActive, currentStep, skipTutorial } = useTutorialStore();

  // Handle ESC key to skip tutorial
  useEffect(() => {
    if (!isTutorialActive) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        skipTutorial();
        analyticsEvents.tutorialSkipped(eventId, currentStep);
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isTutorialActive, currentStep, skipTutorial, eventId]);

  if (!isTutorialActive) {
    return <>{children}</>;
  }

  return (
    <>
      {children}

      {/* Tutorial overlay - rendered above all content */}
      <div className="fixed inset-0 z-[9999] pointer-events-none">
        <TutorialOverlay currentStep={currentStep} />
      </div>
    </>
  );
}
