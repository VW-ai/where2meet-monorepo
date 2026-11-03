'use client';

import { useState, FormEvent } from 'react';
import { MapPin } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import { LocationField } from '@/shared/ui/location-field';
import { participantErrorMessage } from '@/features/meeting/lib/participant-error-message';
import { useMeetingStore } from '@/features/meeting/model/meeting-store';
import { defineMessages, useLocale, useMessages } from '@/shared/lib/i18n';

const messages = defineMessages({
  en: {
    nameRequired: 'Add your name so the group knows who you are.',
    pickSuggestion: 'Pick an address from the suggestions.',
    addressRequired: 'Add where you’re starting from.',
    saveFailed: 'We couldn’t save that location. Try another address.',
    heading: 'Where are you coming from?',
    subheading: 'Add it so your travel time counts too.',
    yourName: 'Your name',
    saving: 'Saving…',
    save: 'Save my location',
  },
  zh: {
    nameRequired: '填一下名字，让大家知道你是谁。',
    pickSuggestion: '请从建议列表中选择一个地址。',
    addressRequired: '填一下你的出发地点。',
    saveFailed: '这个地点没能保存，换个地址试试。',
    heading: '你从哪里出发？',
    subheading: '填上它，你的路程时间也会算进去。',
    yourName: '你的名字',
    saving: '保存中…',
    save: '保存我的出发地点',
  },
});

export const MY_LOCATION_INPUT_ID = 'my-starting-location';

interface MyLocationPromptProps {
  /** Ask for a name too (organizers created before names were collected are "Organizer") */
  askName: boolean;
  onSubmit: (data: { name?: string; address: string }) => Promise<void>;
}

/**
 * Inline "Where are you coming from?" for the viewer's own participant record.
 * Setting your own starting point should be one field, not an edit dialog.
 */
export function MyLocationPrompt({ askName, onSubmit }: MyLocationPromptProps) {
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [placeId, setPlaceId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const mapProvider = useMeetingStore((state) => state.currentEvent?.mapProvider);
  const t = useMessages(messages);
  const locale = useLocale();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (askName && !name.trim()) {
      setError(t.nameRequired);
      return;
    }
    if (!placeId) {
      setError(address.trim() ? t.pickSuggestion : t.addressRequired);
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      await onSubmit({ ...(askName ? { name: name.trim() } : {}), address: address.trim() });
    } catch (err) {
      setError(participantErrorMessage(err, t.saveFailed, locale));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="p-4 rounded-xl bg-coral-50/90 ring-2 ring-coral-500/30 space-y-3"
    >
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 w-9 h-9 rounded-full bg-coral-500 flex items-center justify-center">
          <MapPin className="w-4 h-4 text-white" />
        </div>
        <div className="min-w-0">
          <label
            htmlFor={MY_LOCATION_INPUT_ID}
            className="block text-sm font-semibold text-foreground"
          >
            {t.heading}
          </label>
          <p className="text-xs text-muted-foreground">{t.subheading}</p>
        </div>
      </div>

      {askName && (
        <input
          type="text"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setError(null);
          }}
          placeholder={t.yourName}
          aria-label={t.yourName}
          autoComplete="given-name"
          disabled={isSaving}
          className="w-full px-4 py-2.5 text-sm bg-white rounded-xl shadow-md focus:outline-none focus:ring-2 focus:ring-coral-500/20 placeholder:text-muted-foreground"
        />
      )}

      <LocationField
        id={MY_LOCATION_INPUT_ID}
        value={address}
        provider={mapProvider}
        onChange={(nextAddress, nextPlaceId) => {
          setAddress(nextAddress);
          setPlaceId(nextPlaceId);
          setError(null);
        }}
        onError={setError}
        invalid={!!error}
        disabled={isSaving}
        className={cn('bg-white', error && 'ring-2 ring-red-500')}
      />

      {error && <p className="text-xs text-red-500">{error}</p>}

      <button
        type="submit"
        disabled={isSaving}
        className="w-full px-4 py-2.5 text-sm font-medium bg-coral-500 text-white rounded-full hover:bg-coral-600 active:scale-[0.98] transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-coral-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isSaving ? t.saving : t.save}
      </button>
    </form>
  );
}
