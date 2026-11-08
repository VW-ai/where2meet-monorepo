'use client';

import './phone-plan.css';
import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { LocateFixed, Loader2, MapPin, Share } from 'lucide-react';
import { nextParticipantColor } from '@/features/meeting/lib/participant-colors';
import catLogo from '@/components/cat/logo.svg';
import { useAuthStore } from '@/features/auth/model/auth-store';
import { offsetPoint, avatarTint, whenShort } from '@/features/meeting/lib/phone-plan';
import { useMeetingStore } from '@/features/meeting/model/meeting-store';
import {
  draftAsksName,
  phonePlan,
  usePanelMode,
  usePhonePlanStore,
  useSearchAreaMoved,
} from '@/features/meeting/model/phone-plan-store';
import { defineMessages, useLocale, useMessages } from '@/shared/lib/i18n';
import { AimPanel, RosterPanel, RouteCard, pointUnderPin, shareMeeting } from './phone-people';
import { LockedPanel, PlacesPanel } from './phone-places';
import { AvatarStack, PhoneToast } from './phone-parts';
import { PhoneMenu } from './phone-menu';
import { PhoneSheet } from './phone-sheet';
import { PhoneTicket } from './phone-ticket';

const messages = defineMessages({
  en: {
    menu: 'Meeting menu',
    people: 'People',
    share: 'Share',
    ticket: 'Show the ticket',
    lockedIn: (name: string) => `Locked in · ${name}`,
    searchArea: 'Search this area',
    finding: 'Finding places',
    recenter: 'Show everyone',
    noAddress: 'That spot has no address. Pick one on land.',
  },
  zh: {
    menu: '见面菜单',
    people: '参与的人',
    share: '分享',
    ticket: '查看票面',
    lockedIn: (name: string) => `已确定 · ${name}`,
    searchArea: '搜索这片区域',
    finding: '正在找地点',
    recenter: '查看所有人',
    noAddress: '那个位置没有地址，请选陆地上的位置。',
  },
});

const INK = '#21252B';
const LONG_PRESS_MS = 500;
const LONG_PRESS_SLOP = 10;

function safeTop(): number {
  const probe = document.createElement('div');
  probe.style.cssText =
    'position:fixed;visibility:hidden;height:var(--pp-safe-top,env(safe-area-inset-top,0px))';
  document.querySelector('.pp-plan')?.appendChild(probe);
  const height = probe.getBoundingClientRect().height;
  probe.remove();
  return height;
}

function TopBar() {
  const t = useMessages(messages);
  const locale = useLocale();
  const event = useMeetingStore((state) => state.currentEvent);
  const venue = useMeetingStore((state) =>
    state.currentEvent?.publishedVenueId
      ? state.venueById[state.currentEvent.publishedVenueId]
      : null
  );
  const myId = useAuthStore((state) => state.organizerParticipantId || state.currentParticipantId);
  if (!event) return null;
  const locked = !!event.publishedAt;
  const subtitle = locked
    ? t.lockedIn(venue?.name ?? '')
    : event.meetingTime
      ? whenShort(new Date(event.meetingTime), new Date(), locale)
      : '';
  return (
    <header className="pp-topbar">
      <button
        type="button"
        className="pp-topbar-logo"
        aria-label={t.menu}
        onClick={() => usePhonePlanStore.setState({ menuOpen: true })}
      >
        <Image src={catLogo} alt="" width={32} height={32} className="portal-logo" />
      </button>
      <button
        type="button"
        className="pp-topbar-main"
        aria-label={t.people}
        onClick={phonePlan.showPeople}
      >
        <span className="pp-topbar-title">
          <b>{event.title}</b>
          <small data-locked={locked || undefined}>{subtitle}</small>
        </span>
        <AvatarStack people={event.participants} size={26} max={4} myId={myId} />
      </button>
      <button
        type="button"
        className="pp-topbar-share"
        aria-label={locked ? t.ticket : t.share}
        onClick={() =>
          locked
            ? usePhonePlanStore.setState({ ticketShown: true })
            : void shareMeeting(event.id, event.title)
        }
      >
        <Share size={21} aria-hidden="true" />
      </button>
    </header>
  );
}

function AimPin({ color }: { color: string }) {
  const lifted = usePhonePlanStore((state) => state.pinLifted);
  return (
    <div className="pp-aim-pin" data-lifted={lifted || undefined}>
      <span className="pp-aim-head" style={{ background: color }}>
        <MapPin size={20} strokeWidth={2.5} color="#fff" aria-hidden="true" />
      </span>
      <span className="pp-aim-stem" />
      <span className="pp-aim-dot" />
    </div>
  );
}

function useMapGestures(aiming: boolean) {
  const t = useMessages(messages);
  const noAddress = t.noAddress;
  useEffect(() => {
    const surface = document.querySelector<HTMLElement>('.meeting-map');
    if (!surface) return;
    let press: { x: number; y: number; timer: ReturnType<typeof setTimeout> } | null = null;
    const cancelPress = () => {
      if (press) clearTimeout(press.timer);
      press = null;
    };
    const start = (event: TouchEvent) => {
      cancelPress();
      if (event.touches.length !== 1) return;
      const { clientX: x, clientY: y } = event.touches[0];
      press = {
        x,
        y,
        timer: setTimeout(() => {
          press = null;
          const { api } = usePhonePlanStore.getState();
          const center = api?.center();
          if (!api || !center) return;
          const box = surface.getBoundingClientRect();
          void phonePlan.longPress(
            offsetPoint(center, api.zoom(), x - box.width / 2, y - box.height / 2),
            noAddress
          );
        }, LONG_PRESS_MS),
      };
    };
    const move = (event: TouchEvent) => {
      const touch = event.touches[0];
      if (press && Math.hypot(touch.clientX - press.x, touch.clientY - press.y) > LONG_PRESS_SLOP) {
        cancelPress();
      }
      if (press) return;
      if (usePhonePlanStore.getState().draft?.aiming) phonePlan.aimMoved();
      else usePhonePlanStore.setState({ userMovedMap: true });
    };
    surface.addEventListener('touchstart', start, { passive: true });
    surface.addEventListener('touchmove', move, { passive: true });
    surface.addEventListener('touchend', cancelPress);
    surface.addEventListener('touchcancel', cancelPress);
    return () => {
      cancelPress();
      surface.removeEventListener('touchstart', start);
      surface.removeEventListener('touchmove', move);
      surface.removeEventListener('touchend', cancelPress);
      surface.removeEventListener('touchcancel', cancelPress);
    };
  }, [noAddress]);

  const api = usePhonePlanStore((state) => state.api);
  useEffect(() => {
    if (!api || !aiming) return;
    const look = () => {
      const { panelHeight } = usePhonePlanStore.getState();
      const point = pointUnderPin(panelHeight, safeTop());
      if (point) void phonePlan.aimIdle(point);
    };
    const timer = setTimeout(look, 350);
    const stop = api.onIdle(look);
    return () => {
      clearTimeout(timer);
      stop();
    };
  }, [api, aiming]);
}

/** The whole meeting on a phone: map, one capsule on top, one panel below, as in the app. */
export function PhonePlan() {
  const t = useMessages(messages);
  const eventId = useMeetingStore((state) => state.currentEvent?.id);
  const event = useMeetingStore((state) => state.currentEvent);
  const hydrateVenue = useMeetingStore((state) => state.hydrateVenue);
  const venueById = useMeetingStore((state) => state.venueById);
  const authReady = useAuthStore((state) => state.isAuthInitialized);
  const isOrganizer = useAuthStore((state) => !!state.organizerParticipantId);
  const mode = usePanelMode();
  const draft = usePhonePlanStore((state) => state.draft);
  const ticketShown = usePhonePlanStore((state) => state.ticketShown);
  const menuOpen = usePhonePlanStore((state) => state.menuOpen);
  const userMoved = usePhonePlanStore((state) => state.userMovedMap);
  const searching = usePhonePlanStore((state) => state.searching);
  const panelHeight = usePhonePlanStore((state) => state.panelHeight);
  const venues = useMeetingStore((state) => state.searchedVenues);
  const selected = useMeetingStore((state) => state.selectedVenue);
  const areaMoved = useSearchAreaMoved();
  const started = useRef<string | null>(null);
  const [pinTop, setPinTop] = useState(0);
  const publishedId = event?.publishedVenueId;

  useEffect(() => {
    usePhonePlanStore.setState({ active: true });
    return () => usePhonePlanStore.setState({ active: false });
  }, []);

  useEffect(() => {
    if (!eventId || !authReady || started.current === eventId) return;
    started.current = eventId;
    phonePlan.meetingChanged();
  }, [eventId, authReady]);

  useEffect(() => {
    if (!publishedId) return;
    hydrateVenue(publishedId);
  }, [publishedId, hydrateVenue]);

  useEffect(() => {
    const venue = publishedId ? venueById[publishedId] : null;
    if (venue) useMeetingStore.getState().setSelectedVenue(venue);
  }, [publishedId, venueById]);

  useEffect(() => {
    const top = safeTop() + 8 + 56;
    setPinTop(top + (window.innerHeight - panelHeight - top) / 2);
    document.querySelector<HTMLElement>('.meeting-map')?.style.setProperty('--pp-panel', `${panelHeight}px`);
  }, [panelHeight]);

  useMapGestures(mode === 'aim');

  const current = selected ?? venues[0] ?? null;
  const lockable = isOrganizer && !!current;

  return (
    <div className="pp-plan">
      <TopBar />
      {mode === 'places' && (areaMoved || (searching && venues.length > 0)) && (
        <button type="button" className="pp-search-pill" onClick={phonePlan.searchThisArea}>
          {searching && <Loader2 size={15} className="animate-spin" aria-hidden="true" />}
          {searching ? t.finding : t.searchArea}
        </button>
      )}
      {userMoved && mode !== 'aim' && (
        <button
          type="button"
          className="pp-recenter"
          aria-label={t.recenter}
          style={{ bottom: panelHeight + 12 }}
          onClick={phonePlan.recenter}
        >
          <LocateFixed size={22} aria-hidden="true" />
        </button>
      )}
      {mode === 'aim' && (
        <div className="pp-aim-layer" style={{ top: pinTop }}>
          <AimPin
            color={
              draft && draftAsksName(draft)
                ? avatarTint(nextParticipantColor(event?.participants ?? []))
                : INK
            }
          />
        </div>
      )}
      <PhoneSheet lockable={lockable}>
        {mode === 'locked' && <LockedPanel />}
        {mode === 'roster' && <RosterPanel />}
        {mode === 'places' && <PlacesPanel lockable={lockable} />}
        {mode === 'draft' && draft && <RouteCard draft={draft} />}
        {mode === 'aim' && draft && <AimPanel draft={draft} />}
      </PhoneSheet>
      {menuOpen && <PhoneMenu />}
      {ticketShown && <PhoneTicket />}
      <PhoneToast />
    </div>
  );
}
