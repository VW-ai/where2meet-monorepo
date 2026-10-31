'use client';

import { Input } from '@/shared/ui/input';
import { AppointmentPicker } from '@/shared/ui/appointment-picker';
import { LocationField } from '@/shared/ui/location-field';
import { cn } from '@/shared/lib/cn';
import type { MapProvider } from '@/shared/types/map';

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
  onMapProviderChange: (provider: MapProvider) => void;
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
  onMapProviderChange,
}: HeroInputProps) {
  return (
    <div className="space-y-4 text-left">
      <Input
        aria-label="Occasion"
        placeholder="Date night, team meeting..."
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
          provider={mapProvider}
          className={cn(
            'py-3.5 rounded-2xl border-2 border-gray-200 bg-white shadow-none text-[15px] font-normal text-gray-900',
            'placeholder:text-gray-400 hover:border-gray-300',
            'focus:shadow-none focus:border-coral-500 focus:ring-4 focus:ring-coral-100',
            locationError && 'border-red-400'
          )}
        />
        <p className={cn('mt-1.5 text-xs', locationError ? 'text-red-500' : 'text-[#666b73]')}>
          {locationError ?? 'Optional. Add it so your travel time counts too.'}
        </p>
      </div>

      {/* Google Maps doesn't work in mainland China; those meetings use Amap instead */}
      <label className="flex cursor-pointer items-start gap-2.5">
        <input
          type="checkbox"
          checked={mapProvider === 'amap'}
          onChange={(e) => onMapProviderChange(e.target.checked ? 'amap' : 'google')}
          className="mt-0.5 h-4 w-4 flex-shrink-0 cursor-pointer accent-[#bc3942]"
        />
        <span className="text-sm text-[#21252b]">
          Meeting in mainland China
          <span className="mt-0.5 block text-xs text-[#666b73]">
            Uses Amap (高德地图) for places and routes. You can’t change this later.
          </span>
        </span>
      </label>
    </div>
  );
}
