'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import catLogo from '@/components/cat/image.png';
import { HeroInput } from '@/features/landing/ui/hero-input';
import { ActionButtons } from '@/features/landing/ui/action-buttons';
import { eventClient, participantClient } from '@/features/meeting/api';
import { useAuthStore } from '@/features/auth/model/auth-store';
import { SignInButton } from '@/features/auth/ui/sign-in-button';
import { UserMenu } from '@/features/auth/ui/user-menu';
import { analyticsEvents } from '@/lib/analytics/events';

export default function LandingPage() {
  const router = useRouter();
  const { isAuthenticated, user } = useAuthStore();
  const [title, setTitle] = useState('');
  const [meetingTime, setMeetingTime] = useState('');
  const [organizerName, setOrganizerName] = useState('');
  const [address, setAddress] = useState('');
  const [placeId, setPlaceId] = useState('');
  const [locationError, setLocationError] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [animationLoaded, setAnimationLoaded] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setAnimationLoaded(true), 100);
    return () => clearTimeout(timer);
  }, []);

  // Signed-in users start with their profile name and default address
  useEffect(() => {
    if (!user) return;
    if (user.name) setOrganizerName((current) => current || user.name || '');
    if (user.defaultAddress && user.defaultPlaceId) {
      setAddress((current) => current || user.defaultAddress || '');
      setPlaceId((current) => current || user.defaultPlaceId || '');
    }
  }, [user]);

  const handleLocationChange = (nextAddress: string, nextPlaceId: string) => {
    setAddress(nextAddress);
    setPlaceId(nextPlaceId);
    setLocationError(null);
  };

  // The server creates the organizer as a placeholder participant; fill in who they
  // are and where they start so they land on the map ready to invite people.
  const saveOrganizerDetails = async (eventId: string, participantId: string, token: string) => {
    const name = organizerName.trim();
    try {
      await participantClient.update(
        eventId,
        participantId,
        placeId ? { name, address: address.trim() } : { name },
        token
      );
      if (placeId) analyticsEvents.addLocation(eventId, address.trim());
    } catch (error) {
      console.error('[LandingPage] Could not save organizer details:', error);
      // The address may not geocode; keep the name at least. The meeting page
      // then asks for the location again.
      if (placeId) {
        await participantClient.update(eventId, participantId, { name }, token).catch(() => {});
      }
    }
  };

  const handleCreateEvent = async () => {
    if (!title || !meetingTime || !organizerName.trim()) {
      return;
    }

    if (address.trim() && !placeId) {
      setLocationError('Pick an address from the suggestions, or clear it to add it later.');
      return;
    }

    setIsLoading(true);
    setCreateError(null);

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

        await saveOrganizerDetails(event.id, event.organizerParticipantId, event.participantToken);

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

      // Track event creation in analytics
      analyticsEvents.createEvent(event.id);

      router.push(`/meet/${event.id}`);
    } catch (error) {
      console.error('Error creating event:', error);
      setCreateError('We couldn’t create your meeting. Check your connection and try again.');
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
              Find <span className="text-coral-500">Fair Meeting Spots</span> with Equal Travel
              Times
            </h1>
          </div>

          <div
            className={`bg-white rounded-3xl shadow-xl p-8 md:p-12 mb-8 animate-on-load animate-fade-scale-in animation-delay-400 ${animationLoaded ? 'loaded' : ''}`}
          >
            <HeroInput
              title={title}
              meetingTime={meetingTime}
              organizerName={organizerName}
              address={address}
              locationError={locationError}
              onTitleChange={setTitle}
              onMeetingTimeChange={setMeetingTime}
              onOrganizerNameChange={setOrganizerName}
              onLocationChange={handleLocationChange}
              onLocationError={setLocationError}
            />

            <ActionButtons
              onCreateEvent={handleCreateEvent}
              isLoading={isLoading}
              disabled={!title || !meetingTime || !organizerName.trim()}
            />

            {createError && (
              <p role="alert" className="mt-4 text-sm text-red-600">
                {createError}
              </p>
            )}
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
                ⏱️
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">Equal Travel Times</h3>
              <p className="text-sm text-gray-600">
                Real-time routing calculates actual commutes—not just distance—so everyone's travel
                burden is balanced
              </p>
            </article>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="container mx-auto px-4 py-12 border-t border-gray-200">
        <div className="max-w-2xl mx-auto">
          <nav className="flex flex-wrap justify-center gap-6 text-sm mb-6">
            <Link
              href="/how-it-works"
              className="text-gray-600 hover:text-coral-600 font-medium transition-colors"
            >
              How It Works
            </Link>
            <Link
              href="/scenarios"
              className="text-gray-600 hover:text-coral-600 font-medium transition-colors"
            >
              Scenarios
            </Link>
            <Link
              href="/faq"
              className="text-gray-600 hover:text-coral-600 font-medium transition-colors"
            >
              FAQ
            </Link>
            <Link
              href="/contact"
              className="text-gray-600 hover:text-coral-600 font-medium transition-colors"
            >
              Contact
            </Link>
          </nav>
          <p className="text-center text-sm text-gray-500">
            © {new Date().getFullYear()} Where2Meet. Find fair meeting locations with equal travel
            time for everyone.
          </p>
        </div>
      </footer>
    </div>
  );
}
