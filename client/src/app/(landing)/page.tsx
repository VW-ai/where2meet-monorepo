'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Briefcase, Coffee, Heart, Sun, Users, Utensils, type LucideIcon } from 'lucide-react';
import catLogo from '@/components/cat/logo.svg';
import { HeroInput } from '@/features/landing/ui/hero-input';
import { ActionButtons } from '@/features/landing/ui/action-buttons';
import { StoryPreview } from '@/features/landing/ui/story-preview';
import { LandingBackdrop } from '@/features/landing/ui/landing-backdrop';
import { eventClient, participantClient } from '@/features/meeting/api';
import { useAuthStore } from '@/features/auth/model/auth-store';
import { SignInButton } from '@/features/auth/ui/sign-in-button';
import { UserMenu } from '@/features/auth/ui/user-menu';
import { analyticsEvents } from '@/lib/analytics/events';
import { usePortalStore } from '@/features/portal/model/portal-store';

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
  const logoRef = useRef<HTMLImageElement>(null);
  // While the create-meeting transition runs, the page steps aside for the cat.
  const leaving = usePortalStore((state) => state.status === 'running');

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
  // Resolves to whether their starting point was saved.
  const saveOrganizerDetails = async (
    eventId: string,
    participantId: string,
    token: string
  ): Promise<boolean> => {
    const name = organizerName.trim();
    try {
      await participantClient.update(
        eventId,
        participantId,
        placeId ? { name, address: address.trim() } : { name },
        token
      );
      if (placeId) analyticsEvents.addLocation(eventId, address.trim());
      return !!placeId;
    } catch (error) {
      console.error('[LandingPage] Could not save organizer details:', error);
      // The address may not geocode; keep the name at least. The meeting page
      // then asks for the location again.
      if (placeId) {
        await participantClient.update(eventId, participantId, { name }, token).catch(() => {});
      }
      return false;
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
    const logo = logoRef.current?.getBoundingClientRect();
    usePortalStore
      .getState()
      .start(
        logo ? { left: logo.left, top: logo.top, width: logo.width, height: logo.height } : null
      );
    let hasPin = false;

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

        hasPin = await saveOrganizerDetails(
          event.id,
          event.organizerParticipantId,
          event.participantToken
        );

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

      usePortalStore.getState().created(event.id, hasPin);
      router.push(`/meet/${event.id}`);
    } catch (error) {
      console.error('Error creating event:', error);
      usePortalStore.getState().fail();
      setCreateError('We couldn’t create your meeting. Check your connection and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const scenarios: { label: string; icon: LucideIcon }[] = [
    { label: 'Date night', icon: Heart },
    { label: 'Team meeting', icon: Briefcase },
    { label: 'Group dinner', icon: Utensils },
    { label: 'Coffee catch-up', icon: Coffee },
    { label: 'Weekend hangout', icon: Sun },
    { label: 'Family outing', icon: Users },
  ];

  return (
    <div
      className="flex min-h-screen flex-col text-[#21252b]"
      data-portal-leaving={leaving || undefined}
    >
      <LandingBackdrop />
      <header className="mx-auto flex w-full max-w-xl items-center justify-between px-4 pt-4 sm:pt-5 lg:max-w-5xl lg:px-8 lg:pt-6">
        <div
          className="rounded-full bg-white p-1.5 shadow-[0_3px_16px_rgba(23,37,45,0.15)]"
          data-leave="60"
        >
          <Image
            ref={logoRef}
            src={catLogo}
            alt="Where2Meet"
            width={44}
            height={44}
            className="portal-logo h-9 w-9 lg:h-11 lg:w-11"
            priority
          />
        </div>
        <div
          className="rounded-full bg-white shadow-[0_3px_16px_rgba(23,37,45,0.15)]"
          data-leave="120"
        >
          {isAuthenticated ? <UserMenu /> : <SignInButton />}
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col px-4 py-8 lg:max-w-5xl lg:justify-center lg:px-8 lg:py-10">
        <div className="lg:grid lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] lg:items-stretch lg:gap-10">
          <div className="flex flex-col">
            <h1
              data-leave="140"
              className="mb-5 text-center text-2xl font-bold tracking-[-0.6px] lg:mb-6 lg:text-left lg:text-[44px] lg:leading-[1.05]"
            >
              Plan where to meet, together
            </h1>

            <div
              className="mb-3 flex flex-wrap justify-center gap-2 lg:mb-6 lg:grid lg:w-full lg:grid-cols-2 lg:gap-2.5"
              aria-label="Meeting types"
              role="group"
              data-leave="100"
            >
              {scenarios.map(({ label, icon: Icon }) => {
                const selected = title === label;
                return (
                  <button
                    key={label}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setTitle(label)}
                    className={`inline-flex cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-2 text-sm font-semibold shadow-[0_2px_8px_rgba(23,37,45,0.12)] transition-[background-color,color,box-shadow,translate] duration-150 hover:-translate-y-px hover:shadow-[0_4px_14px_rgba(23,37,45,0.16)] focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#b73540] active:translate-y-0 motion-reduce:transition-none motion-reduce:hover:translate-y-0 lg:px-3 lg:py-2.5 lg:text-[15px] ${
                      selected
                        ? 'bg-[#fff0ef] text-[#bc3942] hover:bg-[#ffe6e4]'
                        : 'bg-white text-[#21252b] hover:bg-[#fff6f5] hover:text-[#bc3942]'
                    }`}
                  >
                    <Icon size={15} className="lg:h-[18px] lg:w-[18px]" aria-hidden="true" />
                    {label}
                  </button>
                );
              })}
            </div>

            <div
              className="rounded-[28px] bg-white p-5 shadow-[0_4px_24px_rgba(23,37,45,0.1)] sm:p-6 lg:p-7"
              data-leave="40"
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
                <p role="alert" className="mt-3 text-sm text-red-600">
                  {createError}
                </p>
              )}
            </div>
          </div>

          <div className="mt-3 lg:mt-0 lg:h-full" data-leave="0">
            <StoryPreview />
          </div>
        </div>
      </main>

      <footer className="mx-auto w-full max-w-xl px-4 py-6 lg:max-w-5xl lg:px-8" data-leave="0">
        <nav className="mb-2 flex justify-center gap-5 text-sm">
          <Link href="/faq" className="font-medium text-[#666b73] hover:text-[#bd3843]">
            FAQ
          </Link>
          <Link href="/contact" className="font-medium text-[#666b73] hover:text-[#bd3843]">
            Contact
          </Link>
        </nav>
        <p className="text-center text-xs text-[#8b9098]">
          © {new Date().getFullYear()} Where2Meet
        </p>
      </footer>
    </div>
  );
}
