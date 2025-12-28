'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useAuthStore } from '@/features/auth/model/auth-store';
import { UserEventResponse } from '@/features/auth/types';
import { userClient } from '@/features/user/api';
import { EventCard } from '@/features/dashboard/ui/event-card';
import { ClaimEventsBanner } from '@/features/dashboard/ui/claim-events-banner';
import { LikedVenuesSection } from '@/features/dashboard/ui/liked-venues-section';
import catLogo from '@/components/cat/image.png';

export default function DashboardPage() {
  const { user, logout } = useAuthStore();
  const [userEvents, setUserEvents] = useState<UserEventResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadEvents() {
      try {
        const userEventsResponse = await userClient.getEvents();
        console.warn('[Dashboard] Events response:', userEventsResponse);

        // API returns array of UserEvent objects with nested event property
        // Response structure: [{ id, role, participantId, event: {...} }, ...]
        let events = userEventsResponse;

        // Handle different response formats
        if (
          userEventsResponse &&
          typeof userEventsResponse === 'object' &&
          'events' in userEventsResponse
        ) {
          events = (userEventsResponse as { events: UserEventResponse[] }).events;
        }

        // Ensure we have an array
        if (Array.isArray(events)) {
          // Keep the full UserEvent objects to preserve role information
          const validUserEvents = events.filter((ue: UserEventResponse) => ue.event != null);

          console.warn('[Dashboard] Valid user events:', validUserEvents);

          // Sort: published events first (by publishedAt desc), then unpublished (by createdAt desc)
          const sortedUserEvents = [...validUserEvents].sort(
            (a: UserEventResponse, b: UserEventResponse) => {
              const aIsPublished = !!a.event.publishedAt;
              const bIsPublished = !!b.event.publishedAt;

              // Both published: newest publishedAt first
              if (aIsPublished && bIsPublished) {
                return (
                  new Date(b.event.publishedAt!).getTime() -
                  new Date(a.event.publishedAt!).getTime()
                );
              }

              // Only a is published: a comes first
              if (aIsPublished) return -1;

              // Only b is published: b comes first
              if (bIsPublished) return 1;

              // Both unpublished: newest createdAt first
              return new Date(b.event.createdAt).getTime() - new Date(a.event.createdAt).getTime();
            }
          );

          setUserEvents(sortedUserEvents);
        } else {
          console.warn('[Dashboard] Events response is not an array:', userEventsResponse);
          setUserEvents([]);
        }
      } catch (error) {
        console.error('Error loading events:', error);
        setUserEvents([]);
      } finally {
        setIsLoading(false);
      }
    }
    loadEvents();
  }, []);

  const handleLogout = async () => {
    await logout();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-coral-50 via-mint-50 to-lavender-50">
      <header className="bg-white/90 backdrop-blur-sm shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-3">
              <Image
                src={catLogo}
                alt="Where2Meet"
                width={40}
                height={40}
                className="w-10 h-10"
                priority
              />
              <span className="font-semibold text-lg text-gray-900">Where2Meet</span>
            </Link>

            <div className="flex items-center gap-4">
              <Link
                href="/dashboard/settings"
                className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
              >
                Settings
              </Link>
              <button
                onClick={handleLogout}
                className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 md:py-12">
        <div className="max-w-6xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">
              Welcome back{user?.name ? `, ${user.name}` : ''}!
            </h1>
            <p className="text-gray-600">Manage your events and settings</p>
          </div>

          <ClaimEventsBanner />

          <LikedVenuesSection />

          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-semibold text-gray-900">My Events</h2>
            <Link
              href="/"
              className="px-4 py-2 bg-coral-500 text-white rounded-full text-sm font-medium hover:bg-coral-600 transition-colors"
            >
              Create New Event
            </Link>
          </div>

          {isLoading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-coral-500 border-t-transparent"></div>
              <p className="mt-4 text-gray-600">Loading your events...</p>
            </div>
          ) : userEvents.length === 0 ? (
            <div className="bg-white rounded-3xl shadow-sm p-12 text-center">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg
                  className="w-8 h-8 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No events yet</h3>
              <p className="text-gray-600 mb-6">
                Create your first event to find the perfect meeting spot
              </p>
              <Link
                href="/"
                className="inline-block px-6 py-3 bg-coral-500 text-white rounded-full font-medium hover:bg-coral-600 transition-colors"
              >
                Create Your First Event
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {userEvents.map((userEvent) => (
                <EventCard key={userEvent.event.id} event={userEvent.event} role={userEvent.role} />
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
