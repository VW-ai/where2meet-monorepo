'use client';

import { useEffect, useId, useState, type FormEvent } from 'react';
import type { Participant } from '@/entities';
import { useSavePersonDetails } from '@/features/meeting/hooks/useParticipantActions';
import { participantErrorMessage } from '@/features/meeting/lib/participant-error-message';
import { useMeetingStore } from '@/features/meeting/model/meeting-store';
import { cn } from '@/shared/lib/cn';
import { defineMessages, useLocale, useMessages } from '@/shared/lib/i18n';
import { LocationField } from '@/shared/ui/location-field';
import { BUTTON, BUTTON_SMALL } from './venue-v2-parts';

const messages = defineMessages({
  en: {
    whereYou: 'Where are you coming from?',
    whereThem: (name: string) => `Where is ${name} coming from?`,
    whyYou: 'Add it so your travel time counts too.',
    whyThem: 'Add it so their travel time counts too.',
    name: 'Name',
    yourName: 'Your name',
    startingLocation: 'Starting location',
    nameRequired: 'Add a name so the group knows who this is.',
    addressRequired: 'Add a starting location.',
    pickSuggestion: 'Pick an address from the suggestions.',
    saveFailed: "We couldn't save that. Try another address.",
    save: 'Save',
    saving: 'Saving…',
    cancel: 'Cancel',
  },
  zh: {
    whereYou: '你从哪里出发？',
    whereThem: (name: string) => `${name}从哪里出发？`,
    whyYou: '填上它，你的路程时间也会算进去。',
    whyThem: '填上它，TA 的路程时间也会算进去。',
    name: '名字',
    yourName: '你的名字',
    startingLocation: '出发地点',
    nameRequired: '填一下名字，让大家知道这是谁。',
    addressRequired: '填一下出发地点。',
    pickSuggestion: '请从建议列表中选择一个地址。',
    saveFailed: '没能保存，换个地址试试。',
    save: '保存',
    saving: '保存中…',
    cancel: '取消',
  },
});

const FIELD =
  'w-full rounded-xl bg-white px-3 py-2 text-sm text-v2-ink shadow-[inset_0_0_0_1px_var(--color-v2-line)] placeholder:text-v2-ink-3 focus:outline-none focus:shadow-[inset_0_0_0_1.5px_var(--color-v2-ink)]';

// Organizers created before names were collected are still called this
const PLACEHOLDER_NAME = 'Organizer';

/**
 * Name and starting point, edited where the person is shown. Without `onCancel` this is the row's
 * standing request for your own starting point, so it asks only for what is missing.
 */
export function PersonDetailsEditor({
  person,
  isSelf,
  onSaved,
  onCancel,
}: {
  person: Participant;
  isSelf: boolean;
  onSaved?: () => void;
  onCancel?: () => void;
}) {
  const t = useMessages(messages);
  const locale = useLocale();
  const provider = useMeetingStore((state) => state.currentEvent?.mapProvider);
  const save = useSavePersonDetails();
  const fieldId = useId();
  const savedAddress = person.address ?? '';
  const hasPlaceholderName = person.isOrganizer && person.name === PLACEHOLDER_NAME;

  const [name, setName] = useState(hasPlaceholderName ? '' : person.name);
  const [address, setAddress] = useState(savedAddress);
  const [placeId, setPlaceId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const openedByClick = !!onCancel;
  const showName = openedByClick || hasPlaceholderName;

  useEffect(() => {
    if (openedByClick) document.getElementById(fieldId)?.focus({ preventScroll: true });
  }, [openedByClick, fieldId]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const trimmedName = name.trim();
    const trimmedAddress = address.trim();
    if (showName && !trimmedName) return setError(t.nameRequired);
    if (!trimmedAddress) return setError(t.addressRequired);
    const addressChanged = trimmedAddress !== savedAddress;
    if (addressChanged && !placeId) return setError(t.pickSuggestion);
    const nameChanged = showName && trimmedName !== person.name;
    if (!nameChanged && !addressChanged) return onSaved?.();

    setSaving(true);
    setError(null);
    try {
      await save(person, {
        ...(nameChanged ? { name: trimmedName } : {}),
        ...(addressChanged ? { address: trimmedAddress } : {}),
      });
      onSaved?.();
    } catch (err) {
      setError(participantErrorMessage(err, t.saveFailed, locale));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && onCancel) onCancel();
      }}
      className="col-span-full grid cursor-default gap-2"
    >
      {!person.address && (
        <div>
          <label htmlFor={fieldId} className="block text-[13.5px] font-semibold text-v2-ink">
            {isSelf ? t.whereYou : t.whereThem(person.name)}
          </label>
          <p className="text-xs text-v2-ink-2">{isSelf ? t.whyYou : t.whyThem}</p>
        </div>
      )}
      {showName && (
        <input
          type="text"
          value={name}
          onChange={(event) => {
            setName(event.target.value);
            setError(null);
          }}
          placeholder={isSelf ? t.yourName : t.name}
          aria-label={isSelf ? t.yourName : t.name}
          autoComplete={isSelf ? 'given-name' : 'off'}
          disabled={saving}
          className={FIELD}
        />
      )}
      <LocationField
        id={fieldId}
        value={address}
        provider={provider}
        placeholder={person.address ? t.startingLocation : undefined}
        onChange={(nextAddress, nextPlaceId) => {
          setAddress(nextAddress);
          setPlaceId(nextPlaceId);
          setError(null);
        }}
        onError={setError}
        invalid={!!error}
        disabled={saving}
        className={cn('bg-white', error && 'ring-2 ring-v2-coral-deep')}
      />
      {error && (
        <p role="alert" className="text-xs text-v2-coral-deep">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        {onCancel && (
          <button
            type="button"
            className={cn(BUTTON.line, BUTTON_SMALL, 'flex-1')}
            onClick={onCancel}
            disabled={saving}
          >
            {t.cancel}
          </button>
        )}
        <button
          type="submit"
          className={cn(BUTTON.ink, BUTTON_SMALL, 'flex-1')}
          disabled={saving}
          aria-busy={saving}
        >
          {saving ? t.saving : t.save}
        </button>
      </div>
    </form>
  );
}
