'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { HeroInput } from '@/components/landing/hero-input';
import { ActionButtons } from '@/components/landing/action-buttons';

export default function LandingPage() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [meetingTime, setMeetingTime] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const handleCreateEvent = async () => {
    if (!title || !meetingTime) {
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch('/api/events', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title,
          meetingTime: new Date(meetingTime).toISOString(),
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create event');
      }

      const event = await response.json();
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
          <div className="flex items-center gap-2">
            <div className="text-2xl font-bold text-coral-600">
              Where<span className="text-mint-600">2</span>Meet
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-12 md:py-20">
        <div className="max-w-2xl mx-auto text-center">
          <div className="mb-12">
            <h1 className="text-4xl md:text-6xl font-bold text-gray-900 mb-4">
              Find the perfect
              <span className="text-coral-500"> meeting spot</span>
            </h1>
            <p className="text-lg md:text-xl text-gray-600">
              Add participants, compare travel times, and discover the ideal location for everyone
            </p>
          </div>

          <div className="bg-white rounded-3xl shadow-xl p-8 md:p-12 mb-8">
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

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
            <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-6">
              <div className="text-3xl mb-3">📍</div>
              <h3 className="font-semibold text-gray-900 mb-2">Fair for Everyone</h3>
              <p className="text-sm text-gray-600">
                Compare travel times and find locations that work for all participants
              </p>
            </div>

            <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-6">
              <div className="text-3xl mb-3">🗺️</div>
              <h3 className="font-semibold text-gray-900 mb-2">Visual Planning</h3>
              <p className="text-sm text-gray-600">
                See everyone's locations on a map with travel routes and times
              </p>
            </div>

            <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-6">
              <div className="text-3xl mb-3">✨</div>
              <h3 className="font-semibold text-gray-900 mb-2">Smart Suggestions</h3>
              <p className="text-sm text-gray-600">
                Get venue recommendations based on optimal location and preferences
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
