'use client';

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { Link2, LocateFixed, MapPin, Navigation, Plus, UserRound, X } from 'lucide-react';
import type { Participant } from '@/entities';
import { useAuthStore } from '@/features/auth/model/auth-store';
import { hasStartingPoint } from '@/features/meeting/lib/person-routes';
import { nextParticipantColor } from '@/features/meeting/lib/participant-colors';
import { avatarTint, initials, offsetPoint } from '@/features/meeting/lib/phone-plan';
import { useMeetingStore } from '@/features/meeting/model/meeting-store';
import {
  draftAsksName,
  phonePlan,
  readRecents,
  startPointAt,
  usePhonePlanStore,
  type PersonDraft,
  type RecentPerson,
} from '@/features/meeting/model/phone-plan-store';
import { useToastStore } from '@/features/meeting/model/toast-store';
import { cn } from '@/shared/lib/cn';
import { defineMessages, useMessages } from '@/shared/lib/i18n';
import { searchPlaceSuggestions } from '@/shared/lib/map-provider';
import type { PlacePrediction } from '@/shared/lib/google-maps/places-autocomplete';
import { ClaimList } from '../sidebar/claim-list';
import { PICKER_MODES, pickerMode } from '../sidebar/transport-parts';
import { travelModeMessages } from '../sidebar/travel-type-filter';
import { Avatar, Cta } from './phone-parts';

const messages = defineMessages({
  en: {
    who: "Who's coming?",
    invite: 'Invite',
    addSelfHint: 'Add starts yourself, or let friends add their own.',
    everyoneHint: 'Everyone adds their own start.',
    linkReady: 'Link ready. Their pin lands here when they join.',
    add: 'Add someone',
    join: 'Join this meeting',
    you: 'You',
    addYourStart: 'Add your start',
    noStart: 'No start yet',
    seePlaces: 'See places near everyone',
    backToPlaces: 'Back to places',
    oneMore: 'Add one more to see places',
    remove: 'Remove',
    removed: (name: string) => `${name} removed`,
    yourRemoved: 'Your start removed',
    undo: 'Undo',
    removeFailed: "Couldn't remove that. Try again.",
    whereStart: 'Where are you starting?',
    change: (name: string) => `Change ${name}'s start`,
    cancel: 'Cancel',
    name: 'Name',
    startingFrom: 'Starting from',
    addNamed: (name: string) => `Add “${name}”`,
    usually: (address: string) => `Usually from ${address}`,
    myLocation: 'Use my location',
    locating: 'Finding you…',
    noLocation: "Couldn't get your location.",
    onMap: 'Set it on the map',
    nameWho: 'Name who starts here',
    addNow: (name: string) => `Add ${name}`,
    joinAs: (name: string) => `Join as ${name}`,
    finding: 'Finding this spot…',
    noAddress: 'No address here',
    dragMap: (name: string) => `Drag the map under the pin to set ${name}'s start.`,
    dragMapYours: 'Drag the map under the pin to set your start.',
    setHere: 'Set start here',
    someone: 'someone',
    clear: 'Clear',
  },
  zh: {
    who: '谁会来？',
    invite: '邀请',
    addSelfHint: '你可以替朋友填出发地，也可以让他们自己填。',
    everyoneHint: '每个人都填自己的出发地。',
    linkReady: '链接已准备好。他们加入后，位置会出现在这里。',
    add: '添加一个人',
    join: '加入这次见面',
    you: '我',
    addYourStart: '填写你的出发地',
    noStart: '还没有出发地',
    seePlaces: '看看大家附近的地点',
    backToPlaces: '回到地点',
    oneMore: '再加一个人就能看地点',
    remove: '移除',
    removed: (name: string) => `已移除${name}`,
    yourRemoved: '已移除你的出发地',
    undo: '撤销',
    removeFailed: '没能移除，请重试。',
    whereStart: '你从哪里出发？',
    change: (name: string) => `修改${name}的出发地`,
    cancel: '取消',
    name: '名字',
    startingFrom: '出发地',
    addNamed: (name: string) => `添加“${name}”`,
    usually: (address: string) => `常从 ${address} 出发`,
    myLocation: '使用我的位置',
    locating: '正在定位…',
    noLocation: '没能获取你的位置。',
    onMap: '在地图上选',
    nameWho: '填写这位朋友的名字',
    addNow: (name: string) => `添加${name}`,
    joinAs: (name: string) => `以${name}的身份加入`,
    finding: '正在查找这个位置…',
    noAddress: '这里没有地址',
    dragMap: (name: string) => `拖动地图，把${name}的出发地对准图钉。`,
    dragMapYours: '拖动地图，把你的出发地对准图钉。',
    setHere: '就从这里出发',
    someone: '这位朋友',
    clear: '清除',
  },
});

function useViewer() {
  const organizerId = useAuthStore((state) => state.organizerParticipantId);
  const participantId = useAuthStore((state) => state.currentParticipantId);
  return { myId: organizerId || participantId, isOrganizer: !!organizerId };
}

export function RosterPanel() {
  const t = useMessages(messages);
  const event = useMeetingStore((state) => state.currentEvent);
  const invited = usePhonePlanStore((state) => state.invited);
  const searchedArea = usePhonePlanStore((state) => state.searchedArea);
  const { myId, isOrganizer } = useViewer();
  const [recents, setRecents] = useState<RecentPerson[]>([]);
  const people = event?.participants ?? [];
  const located = people.filter(hasStartingPoint);

  useEffect(() => setRecents(readRecents()), [people.length]);

  const quickAdds = isOrganizer
    ? recents.filter((recent) => !people.some((person) => person.name === recent.name)).slice(0, 3)
    : [];
  const canAdd = isOrganizer || !myId;
  const hint = invited
    ? t.linkReady
    : people.length >= 2
      ? null
      : isOrganizer
        ? t.addSelfHint
        : t.everyoneHint;
  const ready = located.length >= 2;

  return (
    <>
      <div className="pp-panel-head">
        <h2>{t.who}</h2>
        <button
          type="button"
          className="pp-invite"
          onClick={() => void shareMeeting(event?.id, event?.title)}
        >
          <Link2 size={15} aria-hidden="true" />
          {t.invite}
        </button>
      </div>
      <div className="pp-body" data-pp-scroll>
        {hint && (
          <p className="pp-hint">
            {invited && <span className="pp-breath" />}
            {hint}
          </p>
        )}
        {canAdd && (
          <div className="pp-add-row">
            <button type="button" className="pp-ink-pill" onClick={phonePlan.addSomeone}>
              <Plus size={18} aria-hidden="true" />
              {myId ? t.add : t.join}
            </button>
            {quickAdds.map((recent) => (
              <button
                key={recent.name}
                type="button"
                className="pp-quick"
                onClick={() => void phonePlan.quickAdd(recent)}
              >
                <span className="pp-quick-circle">
                  {initials(recent.name)}
                  <Plus size={10} strokeWidth={3} aria-hidden="true" />
                </span>
                <span className="pp-quick-name">{recent.name}</span>
              </button>
            ))}
          </div>
        )}
        <div className="pp-rows">
          {people.map((person) => (
            <PersonRow key={person.id} person={person} myId={myId} isOrganizer={isOrganizer} />
          ))}
        </div>
      </div>
      <div className="pp-footer">
        <Cta disabled={!ready} onClick={ready ? phonePlan.seePlaces : undefined}>
          {!ready ? t.oneMore : searchedArea !== null ? t.backToPlaces : t.seePlaces}
        </Cta>
      </div>
    </>
  );
}

const REVEAL = 84;

function PersonRow({
  person,
  myId,
  isOrganizer,
}: {
  person: Participant;
  myId: string | null;
  isOrganizer: boolean;
}) {
  const t = useMessages(messages);
  const isMe = person.id === myId;
  const canEdit = isMe || isOrganizer;
  const canRemove = isOrganizer ? !isMe : isMe;
  const [offset, setOffset] = useState(0);
  const drag = useRef<{ x: number; y: number; base: number; axis: 'none' | 'x' | 'y' } | null>(
    null
  );
  const rowRef = useRef<HTMLDivElement>(null);
  const moved = useRef(false);

  useEffect(() => {
    const row = rowRef.current;
    if (!row || !canRemove) return;
    const claimHorizontal = (event: TouchEvent) => {
      if (drag.current?.axis === 'x' && event.cancelable) event.preventDefault();
    };
    row.addEventListener('touchmove', claimHorizontal, { passive: false });
    return () => row.removeEventListener('touchmove', claimHorizontal);
  }, [canRemove]);

  const down = (event: ReactPointerEvent) => {
    moved.current = false;
    if (!canRemove) return;
    drag.current = { x: event.clientX, y: event.clientY, base: offset, axis: 'none' };
  };
  const over = (event: ReactPointerEvent) => {
    const current = drag.current;
    if (!current) return;
    const dx = event.clientX - current.x;
    const dy = event.clientY - current.y;
    if (current.axis === 'none' && Math.hypot(dx, dy) > 6) {
      current.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
      if (current.axis === 'x') event.currentTarget.setPointerCapture(event.pointerId);
    }
    if (current.axis !== 'x') return;
    moved.current = true;
    setOffset(Math.min(0, Math.max(-REVEAL * 1.3, current.base + dx)));
  };
  const up = () => {
    const current = drag.current;
    drag.current = null;
    if (current?.axis === 'x') setOffset((value) => (value < -REVEAL / 2 ? -REVEAL : 0));
  };

  const remove = () => {
    setOffset(0);
    void phonePlan.removeWithUndo(person, {
      removed: t.removed,
      yours: t.yourRemoved,
      undo: t.undo,
      failed: t.removeFailed,
    });
  };

  const address = person.address || (isMe ? t.addYourStart : t.noStart);
  const ModeIcon = pickerMode(person.travelMode).icon;
  return (
    <div className="pp-row-wrap" ref={rowRef}>
      {canRemove && (
        <button
          type="button"
          className="pp-row-remove"
          onClick={remove}
          tabIndex={offset < 0 ? 0 : -1}
        >
          {t.remove}
        </button>
      )}
      <button
        type="button"
        className="pp-row"
        style={{ transform: `translateX(${offset}px)` }}
        data-swiping={drag.current?.axis === 'x' || undefined}
        onPointerDown={down}
        onPointerMove={over}
        onPointerUp={up}
        onPointerCancel={up}
        onClick={() => {
          if (moved.current) return;
          if (offset < 0) return setOffset(0);
          if (canEdit) phonePlan.editStart(person);
        }}
      >
        <Avatar person={person} size={40} isYou={isMe} />
        <span className="pp-row-text">
          <b>{isMe ? t.you : person.name}</b>
          <small>{address}</small>
        </span>
        {person.location && <ModeIcon className="pp-row-mode" aria-hidden="true" />}
      </button>
    </div>
  );
}

export async function shareMeeting(eventId: string | undefined, title: string | undefined) {
  if (!eventId) return;
  const url = `${window.location.origin}/meet/${eventId}`;
  phonePlan.invite();
  if (typeof navigator.share === 'function') {
    try {
      await navigator.share({ title, url });
      return;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return;
    }
  }
  try {
    await navigator.clipboard.writeText(url);
    useToastStore
      .getState()
      .showToast({
        message: document.documentElement.lang === 'zh' ? '链接已复制' : 'Link copied',
      });
  } catch {
    useToastStore.getState().showToast({ message: url });
  }
}

const SUGGEST_DELAY = 250;

function useSuggestions(query: string, enabled: boolean): PlacePrediction[] {
  const provider = useMeetingStore((state) => state.currentEvent?.mapProvider) ?? 'google';
  const near = useMeetingStore(
    (state) => state.currentEvent?.participants.find(hasStartingPoint)?.location ?? undefined
  );
  const [results, setResults] = useState<PlacePrediction[]>([]);
  useEffect(() => {
    if (!enabled || query.trim().length < 2) {
      setResults([]);
      return;
    }
    let stale = false;
    const timer = setTimeout(() => {
      searchPlaceSuggestions(provider, query, { near: near ?? undefined })
        .then((found) => {
          if (!stale) setResults(found);
        })
        .catch(() => {
          if (!stale) setResults([]);
        });
    }, SUGGEST_DELAY);
    return () => {
      stale = true;
      clearTimeout(timer);
    };
  }, [query, enabled, provider, near]);
  return results;
}

export function RouteCard({ draft }: { draft: PersonDraft }) {
  const t = useMessages(messages);
  const modes = useMessages(travelModeMessages).modes;
  const event = useMeetingStore((state) => state.currentEvent);
  const asksName = draftAsksName(draft);
  const nameRef = useRef<HTMLInputElement>(null);
  const startRef = useRef<HTMLInputElement>(null);
  const [locating, setLocating] = useState(false);
  const [locationFailed, setLocationFailed] = useState(false);
  const { kind } = draft;
  const editing = kind.type === 'edit' ? kind.person : null;
  const suggestions = useSuggestions(draft.chosen ? '' : draft.startText, draft.focus === 'start');
  const recents = asksName && kind.type === 'other' ? readRecents() : [];
  const name = draft.name.trim();
  const dotColor = avatarTint(nextParticipantColor(event?.participants ?? []));
  const myId = useAuthStore((state) => state.organizerParticipantId || state.currentParticipantId);

  useEffect(() => {
    if (draft.aiming) return;
    if (draft.focus === 'name' && !name) nameRef.current?.focus({ preventScroll: true });
  }, [draft.focus, draft.aiming, name]);

  const focusField = (focus: PersonDraft['focus']) => {
    phonePlan.updateDraft({ focus });
    phonePlan.setDetent('full');
  };

  const useMyLocation = () => {
    setLocating(true);
    setLocationFailed(false);
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        const point = await startPointAt({ lat: coords.latitude, lng: coords.longitude });
        setLocating(false);
        if (point) phonePlan.choose(point);
        else setLocationFailed(true);
      },
      () => {
        setLocating(false);
        setLocationFailed(true);
      },
      { timeout: 10000 }
    );
  };

  const title = editing
    ? t.change(editing.name)
    : kind.type === 'me'
      ? t.whereStart
      : kind.type === 'join'
        ? t.join
        : t.add;
  const selfLocation = kind.type === 'me' || kind.type === 'join' || editing?.id === myId;
  const needsName = !!draft.chosen && asksName;

  return (
    <>
      <div className="pp-panel-head">
        <h2>{title}</h2>
        {kind.type !== 'me' && (
          <button type="button" className="pp-text-btn" onClick={phonePlan.cancelDraft}>
            {t.cancel}
          </button>
        )}
      </div>
      <div className="pp-body" data-pp-scroll>
        <div className="pp-route">
          {asksName && (
            <label className={cn('pp-route-line', draft.focus === 'name' && 'pp-focus')}>
              <span className="pp-route-dot" style={{ background: dotColor }}>
                <UserRound size={13} aria-hidden="true" />
              </span>
              <input
                ref={nameRef}
                value={draft.name}
                placeholder={t.name}
                aria-label={t.name}
                maxLength={50}
                enterKeyHint="next"
                autoComplete="off"
                onFocus={() => focusField('name')}
                onChange={(e) => phonePlan.updateDraft({ name: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key !== 'Enter') return;
                  if (draft.chosen && name) void phonePlan.commit();
                  else if (name) startRef.current?.focus({ preventScroll: true });
                }}
              />
            </label>
          )}
          <label className={cn('pp-route-line', draft.focus === 'start' && 'pp-focus')}>
            <span className="pp-route-dot" style={{ background: '#21252B' }}>
              <MapPin size={13} aria-hidden="true" />
            </span>
            <input
              ref={startRef}
              value={draft.startText}
              placeholder={editing?.address || t.startingFrom}
              aria-label={t.startingFrom}
              enterKeyHint="search"
              autoComplete="off"
              onFocus={() => focusField('start')}
              onChange={(e) =>
                phonePlan.updateDraft({ startText: e.target.value, chosen: null, error: null })
              }
              onKeyDown={(e) => {
                if (e.key !== 'Enter') return;
                const top = suggestions[0];
                if (top) phonePlan.choose({ label: top.main_text, address: top.full_address });
                else if (draft.startText.trim()) {
                  const typed = draft.startText.trim();
                  phonePlan.choose({ label: typed, address: typed });
                }
              }}
            />
            {draft.startText && (
              <button
                type="button"
                aria-label={t.clear}
                className="pp-clear"
                onClick={() => phonePlan.updateDraft({ startText: '', chosen: null })}
              >
                <X size={14} aria-hidden="true" />
              </button>
            )}
          </label>
        </div>

        <div role="group" aria-label={modes.car} className="pp-modes">
          {PICKER_MODES.map(({ mode, ui, icon: Icon }) => (
            <button
              key={mode}
              type="button"
              aria-pressed={draft.travelMode === mode}
              onClick={() => phonePlan.updateDraft({ travelMode: mode })}
            >
              <Icon aria-hidden="true" />
              {modes[ui]}
            </button>
          ))}
        </div>

        {draft.error && (
          <p role="alert" className="pp-error">
            {draft.error}
          </p>
        )}

        <div className="pp-suggestions">
          {draft.focus === 'name' && name && !draft.chosen && (
            <button
              type="button"
              className="pp-suggestion"
              onClick={() => startRef.current?.focus({ preventScroll: true })}
            >
              <Plus aria-hidden="true" />
              <span>{t.addNamed(name)}</span>
            </button>
          )}
          {draft.focus === 'name' &&
            recents
              .filter((recent) => !name || recent.name.toLowerCase().includes(name.toLowerCase()))
              .slice(0, 5)
              .map((recent) => (
                <button
                  key={recent.name}
                  type="button"
                  className="pp-suggestion"
                  onClick={() => {
                    phonePlan.updateDraft({ name: recent.name });
                    phonePlan.choose({ label: recent.address, address: recent.address });
                  }}
                >
                  <span className="pp-suggestion-avatar">{initials(recent.name)}</span>
                  <span>
                    {recent.name}
                    <small>{t.usually(recent.address)}</small>
                  </span>
                </button>
              ))}
          {draft.focus === 'start' && !draft.chosen && (
            <>
              {suggestions.map((place) => (
                <button
                  key={place.place_id}
                  type="button"
                  className="pp-suggestion"
                  onClick={() =>
                    phonePlan.choose({ label: place.main_text, address: place.full_address })
                  }
                >
                  <MapPin aria-hidden="true" />
                  <span>
                    {place.main_text}
                    <small>{place.secondary_text}</small>
                  </span>
                </button>
              ))}
              {selfLocation && !draft.startText && (
                <button type="button" className="pp-suggestion" onClick={useMyLocation}>
                  <Navigation aria-hidden="true" />
                  <span>
                    {locating ? t.locating : locationFailed ? t.noLocation : t.myLocation}
                  </span>
                </button>
              )}
              <button type="button" className="pp-suggestion" onClick={phonePlan.startAim}>
                <LocateFixed aria-hidden="true" />
                <span>{t.onMap}</span>
              </button>
            </>
          )}
          {kind.type === 'join' && !name && !draft.startText && (
            <ClaimList
              people={(event?.participants ?? []).filter((person) => person.claimable)}
              onClaimed={phonePlan.cancelDraft}
            />
          )}
        </div>
      </div>
      {needsName && (
        <div className="pp-footer">
          <Cta disabled={!name} onClick={name ? () => void phonePlan.commit() : undefined}>
            {!name ? t.nameWho : kind.type === 'join' ? t.joinAs(name) : t.addNow(name)}
          </Cta>
        </div>
      )}
    </>
  );
}

/** The point on the map that sits under the fixed pin. */
export function pinScreenY(panelHeight: number, safeTop: number): number {
  const top = safeTop + 8 + 56;
  return top + (window.innerHeight - panelHeight - top) / 2;
}

export function pointUnderPin(panelHeight: number, safeTop: number) {
  const { api } = usePhonePlanStore.getState();
  const center = api?.center();
  if (!api || !center) return null;
  return offsetPoint(
    center,
    api.zoom(),
    0,
    pinScreenY(panelHeight, safeTop) - window.innerHeight / 2
  );
}

export function AimPanel({ draft }: { draft: PersonDraft }) {
  const t = useMessages(messages);
  const aim = usePhonePlanStore((state) => state.aim);
  const name = draft.name.trim();
  const label =
    aim.kind === 'found' ? aim.point.label : aim.kind === 'nowhere' ? t.noAddress : t.finding;
  const editing = draft.kind.type === 'edit' ? draft.kind.person.name : null;
  const whose = editing ?? (draft.kind.type === 'other' ? name || t.someone : null);
  return (
    <>
      <div className="pp-aim-text">
        <h2>{label}</h2>
        <p>{whose ? t.dragMap(whose) : t.dragMapYours}</p>
      </div>
      <div className="pp-footer pp-footer-row">
        <button
          type="button"
          className="pp-square"
          aria-label={t.cancel}
          onClick={phonePlan.cancelAim}
        >
          <X size={20} aria-hidden="true" />
        </button>
        <Cta disabled={aim.kind !== 'found'} onClick={phonePlan.confirmAim}>
          {t.setHere}
        </Cta>
      </div>
    </>
  );
}
