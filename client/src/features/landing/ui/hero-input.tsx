'use client';

import { Input } from '@/shared/ui/input';
import { AppointmentPicker } from '@/shared/ui/appointment-picker';
import { LocationField } from '@/shared/ui/location-field';
import { cn } from '@/shared/lib/cn';

interface HeroInputProps {
  title: string;
  meetingTime: string;
  organizerName: string;
  address: string;
  locationError?: string | null;
  onTitleChange: (value: string) => void;
  onMeetingTimeChange: (value: string) => void;
  onOrganizerNameChange: (value: string) => void;
  onLocationChange: (address: string, placeId: string) => void;
  onLocationError: (message: string) => void;
}

export function HeroInput({
  title,
  meetingTime,
  organizerName,
  address,
  locationError,
  onTitleChange,
  onMeetingTimeChange,
  onOrganizerNameChange,
  onLocationChange,
  onLocationError,
}: HeroInputProps) {
  return (
    <div className="space-y-4 text-left">
      <Input
        aria-label="Occasion"
        placeholder="Dinner, date, lunch..."
        value={title}
        onChange={(e) => onTitleChange(e.target.value)}
        required
        className="text-[15px] font-normal"
      />

      <AppointmentPicker
        date={meetingTime ? new Date(meetingTime) : undefined}
        onDateTimeChange={(date) => onMeetingTimeChange(date ? date.toISOString() : '')}
      />

      {/* Organizer's own details, so they start on the map instead of as "Organizer" */}
      <Input
        aria-label="Your name"
        placeholder="Your name"
        value={organizerName}
        onChange={(e) => onOrganizerNameChange(e.target.value)}
        autoComplete="given-name"
        required
        className="text-[15px] font-normal"
      />

      <div>
        <label htmlFor="organizer-location" className="sr-only">
          Where are you coming from?
        </label>
        <LocationField
          id="organizer-location"
          value={address}
          onChange={onLocationChange}
          onError={onLocationError}
          invalid={!!locationError}
          placeholder="Where are you coming from?"
          className={cn(
            'py-3.5 rounded-2xl border-2 border-gray-200 bg-white shadow-none text-[15px] font-normal text-gray-900',
            'placeholder:text-gray-400 hover:border-gray-300',
            'focus:shadow-none focus:border-coral-500 focus:ring-4 focus:ring-coral-100',
            locationError && 'border-red-400'
          )}
        />
        <p className={cn('mt-1.5 text-xs', locationError ? 'text-red-500' : 'text-[#666b73]')}>
          {locationError ?? 'Optional. Your travel time counts toward the fair spot too.'}
        </p>
      </div>
    </div>
  );
}
