'use client';

import { useEffect, useRef } from 'react';
import { useTutorialStore } from '../model/tutorial-store';
import { TUTORIAL_STEPS } from '../config/steps';
import { PopoverPosition, getArrowStyles } from '../lib/positioning';
import { cn } from '@/shared/lib/cn';
import { analyticsEvents } from '@/lib/analytics/events';

interface TutorialStepCardProps {
  step: number;
  position: PopoverPosition;
  eventId: string;
}

export function TutorialStepCard({ step, position, eventId }: TutorialStepCardProps) {
  const { nextStep, skipTutorial, markTutorialComplete } = useTutorialStore();
  const stepConfig = TUTORIAL_STEPS[step];
  const isLastStep = step === 3;
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Auto-focus the Next button for keyboard accessibility
  useEffect(() => {
    buttonRef.current?.focus();
  }, [step]);

  const handleNext = () => {
    if (isLastStep) {
      markTutorialComplete();
      analyticsEvents.tutorialCompleted(eventId);
    } else {
      nextStep();
      analyticsEvents.tutorialStepCompleted(eventId, step + 1);
    }
  };

  const handleSkip = () => {
    skipTutorial();
    analyticsEvents.tutorialSkipped(eventId, step);
  };

  if (!stepConfig) return null;

  // Use the actual placement (after any flips) for arrow direction
  // and the calculated offset to point directly at the target
  const arrowStyles = getArrowStyles(position.actualPlacement, position.arrowOffset);

  return (
    <div
      role="dialog"
      aria-labelledby="tutorial-title"
      aria-describedby="tutorial-description"
      aria-modal="true"
      className="absolute bg-white rounded-2xl shadow-2xl p-6 max-w-sm pointer-events-auto animate-tutorial-fade-in"
      style={{
        top: position.top,
        left: position.left,
        transform: position.transform,
        zIndex: 10001,
      }}
    >
      {/* Arrow pointing to target */}
      <div
        className="absolute w-0 h-0"
        style={{
          top: arrowStyles.top,
          bottom: arrowStyles.bottom,
          left: arrowStyles.left,
          right: arrowStyles.right,
          transform: arrowStyles.transform,
          borderWidth: '12px',
          borderStyle: 'solid',
          borderTopColor: arrowStyles.borderTopColor || 'transparent',
          borderBottomColor: arrowStyles.borderBottomColor || 'transparent',
          borderLeftColor: arrowStyles.borderLeftColor || 'transparent',
          borderRightColor: arrowStyles.borderRightColor || 'transparent',
        }}
      />

      {/* Content */}
      <div className="space-y-4">
        {/* Step indicator and skip button */}
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-coral-500 uppercase tracking-wide">
            Step {step + 1} of 4
          </span>
          <button
            onClick={handleSkip}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Skip tutorial"
          >
            Skip tutorial
          </button>
        </div>

        {/* Title */}
        <h3 id="tutorial-title" className="text-lg font-bold text-foreground">
          {stepConfig.title}
        </h3>

        {/* Description */}
        <p id="tutorial-description" className="text-sm text-muted-foreground leading-relaxed">
          {stepConfig.description}
        </p>

        {/* Progress dots */}
        <div className="flex gap-2 justify-center pt-2">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className={cn(
                'h-2 rounded-full transition-all duration-300',
                i === step
                  ? 'bg-coral-500 w-6' // Current step - coral and wider
                  : i < step
                    ? 'bg-mint-400 w-2' // Completed step - mint
                    : 'bg-gray-300 w-2' // Upcoming step - gray
              )}
              aria-label={
                i === step
                  ? `Current step ${i + 1}`
                  : i < step
                    ? `Completed step ${i + 1}`
                    : `Upcoming step ${i + 1}`
              }
            />
          ))}
        </div>

        {/* Action button */}
        <button
          ref={buttonRef}
          onClick={handleNext}
          className="w-full px-6 py-3 bg-coral-500 text-white rounded-full font-medium hover:bg-coral-600 active:scale-[0.98] transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-coral-500 focus:ring-offset-2"
        >
          {isLastStep ? 'Got it!' : 'Next'}
        </button>
      </div>
    </div>
  );
}
