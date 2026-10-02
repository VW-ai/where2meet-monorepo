'use client';

import { useState, FormEvent } from 'react';
import { MapPin } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import { LocationField } from '@/shared/ui/location-field';
import { participantErrorMessage } from '@/features/meeting/lib/participant-error-message';

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

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (askName && !name.trim()) {
      setError('Add your name so the group knows who you are.');
      return;
    }
    if (!placeId) {
      setError(
        address.trim() ? 'Pick an address from the suggestions.' : 'Add where you’re starting from.'
      );
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      await onSubmit({ ...(askName ? { name: name.trim() } : {}), address: address.trim() });
    } catch (err) {
      setError(
        participantErrorMessage(err, 'We couldn’t save that location. Try another address.')
      );
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
            Where are you coming from?
          </label>
          <p className="text-xs text-muted-foreground">Add it so your travel time counts too.</p>
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
          placeholder="Your name"
          aria-label="Your name"
          autoComplete="given-name"
          disabled={isSaving}
          className="w-full px-4 py-2.5 text-sm bg-white rounded-xl shadow-md focus:outline-none focus:ring-2 focus:ring-coral-500/20 placeholder:text-muted-foreground"
        />
      )}

      <LocationField
        id={MY_LOCATION_INPUT_ID}
        value={address}
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
        {isSaving ? 'Saving…' : 'Save my location'}
      </button>
    </form>
  );
}
