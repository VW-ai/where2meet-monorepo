'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import catLogo from '@/components/cat/image.png';
import { HeroInput } from '@/features/landing/ui/hero-input';
import { ActionButtons } from '@/features/landing/ui/action-buttons';
import { eventClient } from '@/features/meeting/api';
import { useAuthStore } from '@/features/auth/model/auth-store';
import { SignInButton } from '@/features/auth/ui/sign-in-button';
import { UserMenu } from '@/features/auth/ui/user-menu';

export default function LandingPage() {
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();
  const [title, setTitle] = useState('');
  const [meetingTime, setMeetingTime] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [animationLoaded, setAnimationLoaded] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setAnimationLoaded(true), 100);
    return () => clearTimeout(timer);
  }, []);

  const handleCreateEvent = async () => {
    if (!title || !meetingTime) {
      return;
    }

    setIsLoading(true);

    try {
      // Calls backend directly, returns event with UUID from backend
      const event = await eventClient.create({
        title,
        meetingTime: new Date(meetingTime).toISOString(),
      });

      console.warn('[LandingPage] Event created:', {
        eventId: event.id,
        hasParticipantToken: !!event.participantToken,
        tokenPrefix: event.participantToken?.substring(0, 3),
        isAuthenticated,
      });

      // Store organizer token and participant ID for organizer actions
      if (event.participantToken && event.organizerParticipantId) {
        console.warn('[LandingPage] Storing organizer credentials:', {
          eventId: event.id,
          hasToken: !!event.participantToken,
          hasParticipantId: !!event.organizerParticipantId,
        });
        const { setOrganizerInfo } = useAuthStore.getState();
        setOrganizerInfo(event.id, event.participantToken, event.organizerParticipantId);
        console.warn('[LandingPage] Auth store after setOrganizerInfo:', {
          isOrganizerMode: useAuthStore.getState().isOrganizerMode,
          hasOrganizerToken: !!useAuthStore.getState().organizerToken,
        });

        // Auto-claim event if user is authenticated
        if (isAuthenticated) {
          console.warn('[LandingPage] User is authenticated, attempting auto-claim...');
          try {
            const { userClient } = await import('@/features/user/api');
            console.warn('[LandingPage] Claiming with token:', {
              eventId: event.id,
              tokenPrefix: event.participantToken.substring(0, 10),
              tokenLength: event.participantToken.length,
            });

            const result = await userClient.claimEvent({
              eventId: event.id,
              participantToken: event.participantToken,
            });

            console.warn('[LandingPage] ✅ Auto-claim successful:', result);
          } catch (claimError) {
            // Non-fatal: event was created successfully, claiming is optional
            console.error('[LandingPage] ❌ Auto-claim failed:', claimError);
            if (claimError instanceof Error) {
              console.error('[LandingPage] Error details:', {
                message: claimError.message,
                stack: claimError.stack,
              });
            }
          }
        } else {
          console.warn('[LandingPage] User NOT authenticated, skipping auto-claim');
        }
      } else {
        console.error('[LandingPage] Missing credentials in event response:', {
          hasParticipantToken: !!event.participantToken,
          hasOrganizerParticipantId: !!event.organizerParticipantId,
        });
      }

      router.push(`/meet/${event.id}`);
    } catch (error) {
      console.error('Error creating event:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-coral-50 via-mint-50 to-lavender-50">
      <header className="container mx-auto px-4 py-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className={`animate-on-load animate-fade-scale-in animation-delay-0 ${animationLoaded ? 'loaded' : ''}`}
            >
              <Image
                src={catLogo}
                alt="Where2Meet Cat Logo"
                width={48}
                height={48}
                className="w-10 h-10 sm:w-12 sm:h-12"
                priority
              />
            </div>
            <h1 className="sr-only">Where2Meet</h1>
          </div>

          {/* Auth components */}
          {isAuthenticated ? <UserMenu /> : <SignInButton />}
        </div>
      </header>

      <main className="container mx-auto px-4 py-12 md:py-20">
        <div className="max-w-2xl mx-auto text-center">
          <div
            className={`mb-12 animate-on-load animate-fade-slide-up animation-delay-200 ${animationLoaded ? 'loaded' : ''}`}
          >
            <h1 className="text-4xl md:text-6xl font-bold text-gray-900 mb-4">
              Find the perfect
              <span className="text-coral-500"> meeting spot</span>
            </h1>
            <p className="text-lg md:text-xl text-gray-600">
              Add participants, compare travel times, and discover the ideal location for everyone
            </p>
          </div>

          <div
            className={`bg-white rounded-3xl shadow-xl p-8 md:p-12 mb-8 animate-on-load animate-fade-scale-in animation-delay-400 ${animationLoaded ? 'loaded' : ''}`}
          >
            <HeroInput
              title={title}
              meetingTime={meetingTime}
              onTitleChange={setTitle}
              onMeetingTimeChange={setMeetingTime}
            />

            <ActionButtons
              onCreateEvent={handleCreateEvent}
              isLoading={isLoading}
              disabled={!title || !meetingTime}
            />
          </div>

          <section
            aria-label="Features"
            className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left"
          >
            <article
              className={`bg-white/60 backdrop-blur-sm rounded-2xl p-6 animate-on-load animate-fade-slide-up animation-delay-600 ${animationLoaded ? 'loaded' : ''}`}
            >
              <div className="text-3xl mb-3" aria-hidden="true">
                📍
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">Fair for Everyone</h3>
              <p className="text-sm text-gray-600">
                Compare travel times and find locations that work for all participants
              </p>
            </article>

            <article
              className={`bg-white/60 backdrop-blur-sm rounded-2xl p-6 animate-on-load animate-fade-slide-up animation-delay-800 ${animationLoaded ? 'loaded' : ''}`}
            >
              <div className="text-3xl mb-3" aria-hidden="true">
                🗺️
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">Visual Planning</h3>
              <p className="text-sm text-gray-600">
                See everyone's locations on a map with travel routes and times
              </p>
            </article>

            <article
              className={`bg-white/60 backdrop-blur-sm rounded-2xl p-6 animate-on-load animate-fade-slide-up animation-delay-1000 ${animationLoaded ? 'loaded' : ''}`}
            >
              <div className="text-3xl mb-3" aria-hidden="true">
                ✨
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">Smart Suggestions</h3>
              <p className="text-sm text-gray-600">
                Get venue recommendations based on optimal location and preferences
              </p>
            </article>
          </section>
        </div>
      </main>
    </div>
  );
}
