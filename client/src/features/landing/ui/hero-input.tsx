'use client';

import { Input } from '@/shared/ui/input';
import { AppointmentPicker } from '@/shared/ui/appointment-picker';
import { LocationField } from '@/shared/ui/location-field';
import { cn } from '@/shared/lib/cn';
import type { MapProvider } from '@/shared/types/map';
import { defineMessages, useMessages } from '@/shared/lib/i18n';

const messages = defineMessages({
  en: {
    occasion: 'Occasion',
    occasionPlaceholder: 'Date night, team meeting...',
    name: 'Your name',
    location: 'Where are you coming from?',
    locationHint: 'Optional. Add it so your travel time counts too.',
  },
  zh: {
    occasion: '活动',
    occasionPlaceholder: '约会、团队聚餐…',
    name: '你的名字',
    location: '你从哪里出发？',
    locationHint: '选填。填上后也会算上你的路程时间。',
  },
});

interface HeroInputProps {
  title: string;
  meetingTime: string;
  organizerName: string;
  address: string;
  locationError?: string | null;
  mapProvider: MapProvider;
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
  mapProvider,
  onTitleChange,
  onMeetingTimeChange,
  onOrganizerNameChange,
  onLocationChange,
  onLocationError,
}: HeroInputProps) {
  const t = useMessages(messages);
  return (
    <div className="space-y-4 text-left">
      <Input
        aria-label={t.occasion}
        placeholder={t.occasionPlaceholder}
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
        aria-label={t.name}
        placeholder={t.name}
        value={organizerName}
        onChange={(e) => onOrganizerNameChange(e.target.value)}
        autoComplete="given-name"
        required
        className="text-[15px] font-normal"
      />

      <div>
        <label htmlFor="organizer-location" className="sr-only">
          {t.location}
        </label>
        <LocationField
          id="organizer-location"
          value={address}
          onChange={onLocationChange}
          onError={onLocationError}
          invalid={!!locationError}
          placeholder={t.location}
          provider={mapProvider}
          className={cn(
            'py-3.5 rounded-2xl border-2 border-gray-200 bg-white shadow-none text-[15px] font-normal text-gray-900',
            'placeholder:text-gray-500 hover:border-gray-300',
            'focus:shadow-none focus:border-coral-500 focus:ring-4 focus:ring-coral-100',
            locationError && 'border-red-400'
          )}
        />
        <p className={cn('mt-1.5 text-xs', locationError ? 'text-red-500' : 'text-[#666b73]')}>
          {locationError ?? t.locationHint}
        </p>
      </div>
    </div>
  );
}
