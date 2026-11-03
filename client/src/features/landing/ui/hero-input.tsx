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
    china: 'Meeting in mainland China',
    chinaHint: 'Uses Amap (高德地图) for places and routes. You can’t change this later.',
  },
  zh: {
    occasion: '活动',
    occasionPlaceholder: '约会、团队聚餐…',
    name: '你的名字',
    location: '你从哪里出发？',
    locationHint: '选填。填上后也会算上你的路程时间。',
    china: '在中国大陆见面',
    chinaHint: '使用高德地图查找地点和路线，创建后不能更改。',
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

      {/* Google Maps doesn't work in mainland China; those meetings use Amap and Chinese text */}
      <label className="flex w-fit cursor-pointer items-center gap-2.5" title={t.chinaHint}>
        <ChinaFlag className="h-5 w-[30px] flex-shrink-0 rounded-[3px]" />
        <input
          type="checkbox"
          role="switch"
          aria-label={t.china}
          aria-description={t.chinaHint}
          checked={mapProvider === 'amap'}
          onChange={(e) => onMapProviderChange(e.target.checked ? 'amap' : 'google')}
          className="peer sr-only"
        />
        <span
          aria-hidden="true"
          className={cn(
            'relative h-6 w-10 flex-shrink-0 rounded-full bg-gray-300 transition-colors',
            'after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow after:transition-transform',
            'peer-checked:bg-[#bc3942] peer-checked:after:translate-x-4',
            'peer-focus-visible:ring-4 peer-focus-visible:ring-coral-100'
          )}
        />
      </label>
    </div>
  );
}

// Drawn rather than an emoji, since Windows shows flag emoji as the letters "CN"
function ChinaFlag({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 30 20" className={className} aria-hidden="true">
      <rect width="30" height="20" fill="#de2910" />
      <g fill="#ffde00">
        <polygon points="5,2 5.9,4.8 8.8,4.8 6.4,6.5 7.3,9.3 5,7.6 2.7,9.3 3.6,6.5 1.2,4.8 4.1,4.8" />
        <circle cx="10" cy="2" r="0.9" />
        <circle cx="12" cy="4" r="0.9" />
        <circle cx="12" cy="7" r="0.9" />
        <circle cx="10" cy="9" r="0.9" />
      </g>
    </svg>
  );
}
