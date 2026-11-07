'use client';

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { MapPin, Plus, X } from 'lucide-react';
import type { Participant } from '@/entities';
import { useAuthStore } from '@/features/auth/model/auth-store';
import { useDraftPreview } from '@/features/meeting/hooks/useDraftPreview';
import {
  addStep,
  draftPerson,
  modeEstimate,
  type PickedPlace,
} from '@/features/meeting/lib/add-person-form';
import { nextParticipantColor } from '@/features/meeting/lib/participant-colors';
import { formatTripTime } from '@/features/meeting/lib/route-summary';
import { useDraftPersonStore } from '@/features/meeting/model/draft-person-store';
import { useMeetingStore } from '@/features/meeting/model/meeting-store';
import { useUIStore } from '@/features/meeting/model/ui-store';
import { cn } from '@/shared/lib/cn';
import { defineMessages, useLocale, useMessages } from '@/shared/lib/i18n';
import type { TravelMode } from '@/shared/types/map';
import { LocationField } from '@/shared/ui/location-field';
import type { ParticipantFormData } from './add-participant';
import { ClaimList } from './claim-list';
import { ModeGrid } from './transport-parts';
import { BUTTON, ParticipantAvatar } from './venue-v2-parts';

const messages = defineMessages({
  en: {
    cancel: 'Cancel',
    changePlace: 'Change place',
    useDefaultAddress: 'Use my saved address',
    noRoute: 'No route',
    add: {
      formLabel: 'Add a person',
      nameLabel: 'Their name',
      namePlaceholder: "Who's coming?",
      sendLink: 'Or send them the link instead',
      from: (name: string) => `Where is ${name} coming from?`,
      how: (name: string) => `How is ${name} getting there?`,
      note: (name: string) =>
        `You set this for now. If ${name} opens the link, they can take it over.`,
      submit: (name: string) => `Add ${name}`,
      submitting: 'Adding…',
    },
    join: {
      formLabel: 'Join the plan',
      title: (event: string) => `Join ${event}`,
      nameLabel: 'Your name',
      namePlaceholder: 'Your name',
      from: () => 'Where are you coming from?',
      how: () => 'How are you getting there?',
      note: () => 'Only you can change this later.',
      submit: () => 'Join plan',
      submitting: 'Joining…',
    },
  },
  zh: {
    cancel: '取消',
    changePlace: '更换地点',
    useDefaultAddress: '使用我保存的地址',
    noRoute: '暂无路线',
    add: {
      formLabel: '添加一个人',
      nameLabel: 'TA 的名字',
      namePlaceholder: '谁要来？',
      sendLink: '或者把链接发给 TA',
      from: (name: string) => `${name}从哪里出发？`,
      how: (name: string) => `${name}怎么过去？`,
      note: (name: string) => `先由你来设置。如果${name}打开链接，可以自己接管。`,
      submit: (name: string) => `添加${name}`,
      submitting: '添加中…',
    },
    join: {
      formLabel: '加入计划',
      title: (event: string) => `加入“${event}”`,
      nameLabel: '你的名字',
      namePlaceholder: '你的名字',
      from: () => '你从哪里出发？',
      how: () => '你怎么过去？',
      note: () => '之后只有你能修改。',
      submit: () => '加入计划',
      submitting: '加入中…',
    },
  },
});

const NAME_INPUT_ID = 'add-person-name';
const PLACE_INPUT_ID = 'add-person-place';

const FOCUS_RING =
  'focus:shadow-[inset_0_0_0_1.5px_var(--color-v2-coral),0_0_0_3px_var(--color-v2-coral-wash)]';
const FIELD_LOOK = cn(
  'h-[38px] rounded-xl bg-white text-v2-ink shadow-[inset_0_0_0_1px_var(--color-v2-line)] placeholder:font-normal placeholder:text-v2-ink-3 focus:outline-none focus:ring-0',
  FOCUS_RING
);
const LABEL = 'text-[13px] font-semibold text-v2-ink';
const ROUND_BUTTON =
  'grid size-7 flex-none place-items-center rounded-full text-v2-ink-2 hover:bg-[#efebe5] focus-visible:outline-2 focus-visible:outline-v2-ink [&_svg]:size-[15px]';

function CloseButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      className={ROUND_BUTTON}
      onClick={onClick}
      aria-label={label}
      title={label}
    >
      <X aria-hidden="true" />
    </button>
  );
}

/**
 * Adding someone, or joining, one answer at a time. Steps stay mounted once shown, so their fade
 * runs when they first appear and never again as the name is typed.
 */
export function AddPersonForm({
  kind,
  onSubmit,
  onCancel,
  isSubmitting,
}: {
  kind: 'add' | 'join';
  onSubmit: (data: ParticipantFormData) => void;
  onCancel: () => void;
  isSubmitting: boolean;
}) {
  const t = useMessages(messages);
  const words = t[kind];
  const locale = useLocale();
  const event = useMeetingStore((state) => state.currentEvent);
  const defaultAddress = useAuthStore((state) => state.user?.defaultAddress);
  const defaultPlaceId = useAuthStore((state) => state.user?.defaultPlaceId);
  const openShareModal = useUIStore((state) => state.openShareModal);

  const [name, setName] = useState('');
  const [query, setQuery] = useState('');
  const [place, setPlace] = useState<PickedPlace | null>(null);
  const [mode, setMode] = useState<TravelMode>('driving');
  const [placeError, setPlaceError] = useState<string | null>(null);
  const submitRef = useRef<HTMLButtonElement>(null);

  const participants = event?.participants ?? [];
  const trimmedName = name.trim();
  const step = addStep(name, place);
  const color = nextParticipantColor(participants);
  const claimable: Participant[] = kind === 'join' ? participants.filter((p) => p.claimable) : [];

  // Visitors get no preview: the endpoint is the organizer's
  const preview = useDraftPreview(kind === 'add' ? place : null);

  const draft = draftPerson(preview, mode, color, trimmedName);
  const setDraft = useDraftPersonStore((state) => state.setDraft);
  const draftLocation = draft?.location;
  const draftRoute = draft?.route;
  useEffect(() => {
    setDraft(
      draftLocation
        ? { name: trimmedName, color, location: draftLocation, route: draftRoute ?? null }
        : null
    );
  }, [setDraft, trimmedName, color, draftLocation, draftRoute]);
  useEffect(() => () => setDraft(null), [setDraft]);

  // On a phone the half-height sheet has no room for the steps or the suggestions
  useEffect(() => {
    const { isSheetExpanded, setSheetExpanded } = useUIStore.getState();
    setSheetExpanded(true);
    return () => setSheetExpanded(isSheetExpanded);
  }, []);

  const hadPlace = useRef(false);
  useEffect(() => {
    if (place) submitRef.current?.focus();
    else if (hadPlace.current) document.getElementById(PLACE_INPUT_ID)?.focus();
    hadPlace.current = !!place;
  }, [place]);

  const pickPlace = (address: string, placeId: string) => {
    setQuery(address);
    setPlaceError(null);
    if (placeId) setPlace({ address, placeId });
  };

  const clearPlace = () => {
    setPlace(null);
    setQuery('');
  };

  const submit = (formEvent?: FormEvent) => {
    formEvent?.preventDefault();
    if (isSubmitting || !trimmedName || !place) return;
    onSubmit({
      name: trimmedName,
      address: place.address,
      placeId: place.placeId,
      travelMode: mode,
    });
  };

  const handleKeyDown = (keyEvent: KeyboardEvent<HTMLFormElement>) => {
    const target = keyEvent.target as HTMLElement;
    if (keyEvent.key === 'Escape') {
      // This form's to handle: the venue panel behind it closes on Escape as well
      keyEvent.stopPropagation();
      // An open suggestion list has just closed on this same key
      if (target.getAttribute('aria-expanded') !== 'true') onCancel();
      return;
    }
    if (keyEvent.key !== 'Enter') return;
    if (target.id === NAME_INPUT_ID) {
      keyEvent.preventDefault();
      if (place) submit();
      else if (trimmedName) document.getElementById(PLACE_INPUT_ID)?.focus();
    } else if (target.id === PLACE_INPUT_ID) {
      keyEvent.preventDefault();
    }
  };

  return (
    <form
      aria-label={words.formLabel}
      data-own-focus-ring
      onSubmit={submit}
      onKeyDown={handleKeyDown}
      className="grid grid-cols-[minmax(0,1fr)] gap-2.5 rounded-2xl bg-v2-wash p-2.5 text-[13px] text-v2-ink [overflow-wrap:anywhere]"
    >
      {kind === 'join' && (
        <div className="flex items-center justify-between gap-2">
          <b className="min-w-0 truncate text-sm font-semibold">
            {t.join.title(event?.title ?? '')}
          </b>
          <CloseButton onClick={onCancel} label={t.cancel} />
        </div>
      )}

      {!trimmedName && <ClaimList people={claimable} onClaimed={onCancel} />}

      <div className="flex items-center gap-[9px]">
        {trimmedName ? (
          <ParticipantAvatar participant={{ name: trimmedName, color }} large />
        ) : (
          <span
            aria-hidden="true"
            className="grid size-8 flex-none place-items-center rounded-full border-[1.5px] border-dashed border-[#d8d4cd] text-v2-ink-3"
          >
            <Plus className="size-3.5" />
          </span>
        )}
        <input
          id={NAME_INPUT_ID}
          type="text"
          value={name}
          onChange={(changeEvent) => setName(changeEvent.target.value)}
          placeholder={words.namePlaceholder}
          aria-label={words.nameLabel}
          maxLength={50}
          autoFocus
          autoComplete="off"
          className={cn(
            FIELD_LOOK,
            'w-full min-w-0 flex-1 px-3 text-sm transition-shadow [&:not(:placeholder-shown)]:font-semibold'
          )}
        />
        {kind === 'add' && <CloseButton onClick={onCancel} label={t.cancel} />}
      </div>

      {kind === 'add' && step === 'name' && (
        <button
          type="button"
          onClick={openShareModal}
          className="ml-[41px] justify-self-start text-left text-xs text-v2-ink-3 underline underline-offset-2 hover:text-v2-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-v2-ink"
        >
          {t.add.sendLink}
        </button>
      )}

      {step !== 'name' && (
        <div className="form-step-in grid grid-cols-[minmax(0,1fr)] gap-1.5">
          <div className="flex items-baseline justify-between gap-2">
            <label htmlFor={place ? undefined : PLACE_INPUT_ID} className={LABEL}>
              {words.from(trimmedName)}
            </label>
            {!place && defaultAddress && defaultPlaceId && (
              <button
                type="button"
                onClick={() => pickPlace(defaultAddress, defaultPlaceId)}
                className="flex-none text-xs text-v2-ink-3 underline underline-offset-2 hover:text-v2-ink"
              >
                {t.useDefaultAddress}
              </button>
            )}
          </div>
          {place ? (
            <div className="flex min-h-[38px] items-center gap-2 rounded-xl bg-white py-1 pl-3 pr-1 font-medium shadow-[inset_0_0_0_1px_var(--color-v2-line)]">
              <MapPin className="size-3.5 flex-none text-v2-ink-3" aria-hidden="true" />
              <span className="min-w-0 flex-1 truncate" title={place.address}>
                {place.address}
              </span>
              <CloseButton onClick={clearPlace} label={t.changePlace} />
            </div>
          ) : (
            <LocationField
              id={PLACE_INPUT_ID}
              value={query}
              provider={event?.mapProvider}
              onChange={pickPlace}
              onError={setPlaceError}
              invalid={!!placeError}
              className={cn(FIELD_LOOK, 'py-0 backdrop-blur-none')}
            />
          )}
          {placeError && <p className="text-xs text-v2-coral-deep">{placeError}</p>}
        </div>
      )}

      {step === 'mode' && (
        <>
          <div className="form-step-in grid grid-cols-[minmax(0,1fr)] gap-1.5">
            <p className={LABEL}>{words.how(trimmedName)}</p>
            <ModeGrid
              value={mode}
              onChange={setMode}
              label={words.how(trimmedName)}
              detailOf={(option, modeLabel) => {
                const estimate = modeEstimate(preview, option);
                if (estimate.kind === 'time') return formatTripTime(estimate.seconds, locale);
                return estimate.kind === 'none' ? t.noRoute : modeLabel;
              }}
            />
            <p className="text-xs leading-[1.4] text-v2-ink-3">{words.note(trimmedName)}</p>
          </div>
          <button
            ref={submitRef}
            type="submit"
            aria-busy={isSubmitting}
            // Held down, the Enter that picked the place repeats here and must not add them too
            onKeyDown={(keyEvent) => {
              if (keyEvent.key === 'Enter' && keyEvent.repeat) keyEvent.preventDefault();
            }}
            className={cn(
              BUTTON.ink,
              'form-step-in w-full focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_var(--color-v2-coral-wash),0_0_0_4.5px_var(--color-v2-coral)]'
            )}
          >
            <span className="min-w-0 truncate">
              {isSubmitting ? words.submitting : words.submit(trimmedName)}
            </span>
          </button>
        </>
      )}
    </form>
  );
}
