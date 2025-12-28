'use client';

import Link from 'next/link';
import { Event } from '@/entities';

interface EventCardProps {
  event: Event;
  role?: 'organizer' | 'participant';
}

export function EventCard({ event, role }: EventCardProps) {
  const participantCount = event.participants?.length || 0;
  const isPublished = event.publishedVenueId !== null;

  const formattedDate = event.meetingTime
    ? new Date(event.meetingTime).toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })
    : 'No time set';

  return (
    <Link href={`/meet/${event.id}`}>
      <div className="bg-white rounded-2xl shadow-sm hover:shadow-md transition-shadow p-6 border border-gray-100 cursor-pointer">
        <div className="flex items-start justify-between mb-3">
          <h3 className="text-lg font-semibold text-gray-900 line-clamp-2">{event.title}</h3>
          <div className="flex gap-2 flex-shrink-0 ml-2">
            {role && (
              <span
                className={`px-2 py-1 text-xs font-medium rounded-full ${
                  role === 'organizer'
                    ? 'bg-coral-100 text-coral-700'
                    : 'bg-lavender-100 text-lavender-700'
                }`}
              >
                {role === 'organizer' ? 'Organizer' : 'Participant'}
              </span>
            )}
            {isPublished && (
              <span className="px-2 py-1 text-xs font-medium bg-mint-100 text-mint-700 rounded-full">
                Published
              </span>
            )}
          </div>
        </div>

        <div className="space-y-2 text-sm text-gray-600">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            <span>{formattedDate}</span>
          </div>

          <div className="flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
              />
            </svg>
            <span>
              {participantCount} {participantCount === 1 ? 'participant' : 'participants'}
            </span>
          </div>

          {isPublished && event.publishedAt && (
            <div className="flex items-center gap-2 text-mint-600">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
              <span>
                Published{' '}
                {new Date(event.publishedAt).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                })}
              </span>
            </div>
          )}
        </div>

        <div className="mt-4 pt-4 border-t border-gray-100">
          <span className="text-xs text-gray-500">
            Created{' '}
            {new Date(event.createdAt).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })}
          </span>
        </div>
      </div>
    </Link>
  );
}
