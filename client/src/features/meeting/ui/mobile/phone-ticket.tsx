'use client';

import '@fontsource/anton/400.css';
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { CalendarPlus, Check, Copy, Download, Link2, MapPin, Share } from 'lucide-react';
import { useAuthStore } from '@/features/auth/model/auth-store';
import { calendarFile } from '@/features/invitation/model/calendar';
import { invitationFor, isPublished, shareText } from '@/features/invitation/model/invitation';
import { planKind, PLAN_KIND_LABEL, whenText } from '@/features/meeting/lib/phone-plan';
import { useMeetingStore } from '@/features/meeting/model/meeting-store';
import { usePhonePlanStore } from '@/features/meeting/model/phone-plan-store';
import { analyticsEvents } from '@/lib/analytics/events';
import { defineMessages, useLocale, useMessages } from '@/shared/lib/i18n';
import { AvatarStack, BrandMark, KIND_ICON, Marquee, useFittedWord } from './phone-parts';

const messages = defineMessages({
  en: {
    invited: "You're invited",
    when: 'WHEN',
    going: 'GOING',
    hostedByYou: 'Hosted by you',
    together: 'Together',
    issued: (date: string) => `ISSUED ${date}`,
    confirmed: 'CONFIRMED',
    share: 'Share via',
    link: 'Copy link',
    image: 'Copy image',
    save: 'Save',
    calendar: 'Calendar',
    close: 'Close',
    pull: 'Pull the ticket down to close',
  },
  zh: {
    invited: '邀请你来',
    when: '时间',
    going: '人数',
    hostedByYou: '由你发起',
    together: '一起去',
    issued: (date: string) => `签发 ${date}`,
    confirmed: '已确定',
    share: '分享到',
    link: '复制链接',
    image: '复制图片',
    save: '保存',
    calendar: '日历',
    close: '关闭',
    pull: '把票面往下拉就能关闭',
  },
});

type ActionId = 'share' | 'link' | 'image' | 'save' | 'calendar';

const ICONS = { share: Share, link: Link2, image: Copy, save: Download, calendar: CalendarPlus };
const WORD_SIZES = [92, 76, 64, 54, 46, 38, 32];
const CLOSE_DISTANCE = 120;
const CLOSE_PROJECTED = 400;
const DONE_MS = 1400;

function download(href: string, filename: string) {
  const link = document.createElement('a');
  link.href = href;
  link.download = filename;
  link.click();
}

export function PhoneTicket() {
  const t = useMessages(messages);
  const locale = useLocale();
  const event = useMeetingStore((state) => state.currentEvent);
  const venueById = useMeetingStore((state) => state.venueById);
  const myId = useAuthStore((state) => state.organizerParticipantId || state.currentParticipantId);
  const isOrganizer = useAuthStore((state) => !!state.organizerParticipantId);
  const [done, setDone] = useState<ActionId | null>(null);
  const [drag, setDrag] = useState({ x: 0, y: 0, active: false });
  const [entered, setEntered] = useState(false);
  const start = useRef<{ x: number; y: number; lastY: number; at: number; speed: number } | null>(
    null
  );
  const portrait = useRef<Promise<Blob> | null>(null);
  const [wordRef, wordSize] = useFittedWord<HTMLHeadingElement>(event?.title ?? '', WORD_SIZES);

  const close = () => usePhonePlanStore.setState({ ticketShown: false });
  const eventId = event?.id;
  const imageUrl = `/meet/${eventId}/invite.png?format=portrait`;

  useEffect(() => {
    const raf = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    if (!eventId) return;
    const pending = fetch(imageUrl).then((response) => {
      if (!response.ok) throw new Error(`invitation image: ${response.status}`);
      return response.blob();
    });
    pending.catch((error: unknown) => console.error(error));
    portrait.current = pending;
  }, [eventId, imageUrl]);

  useEffect(() => {
    if (!done) return;
    const timer = setTimeout(() => setDone(null), DONE_MS);
    return () => clearTimeout(timer);
  }, [done]);

  if (!event || !isPublished(event)) return null;
  const venue = venueById[event.publishedVenueId] ?? null;
  const invitation = invitationFor(event, venue, window.location.origin);
  const ics = calendarFile(invitation, new Date());
  const kind = planKind(event.title);
  const KindIcon = KIND_ICON[kind];
  const when = event.meetingTime ? new Date(event.meetingTime) : null;
  const zone = event.meetingTimeZone ?? undefined;

  const canShare = typeof navigator.share === 'function';
  const canCopyImage =
    typeof ClipboardItem !== 'undefined' && typeof navigator.clipboard?.write === 'function';

  const run: Record<ActionId, () => Promise<void> | void> = {
    share: async () => {
      const data: ShareData = {
        title: invitation.title,
        text: shareText(invitation),
        url: invitation.url,
      };
      const blob = await portrait.current?.catch(() => null);
      const file = blob && new File([blob], 'invitation.png', { type: 'image/png' });
      if (file && navigator.canShare?.({ files: [file] })) data.files = [file];
      try {
        await navigator.share(data);
        analyticsEvents.shareEvent(event.id, 'social');
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') return;
        throw error;
      }
    },
    link: async () => {
      await navigator.clipboard.writeText(invitation.url);
      analyticsEvents.shareEvent(event.id, 'link');
    },
    image: () => {
      if (!portrait.current) return;
      return navigator.clipboard.write([new ClipboardItem({ 'image/png': portrait.current })]);
    },
    save: () => download(imageUrl, 'invitation.png'),
    calendar: () => {
      if (!ics) return;
      const href = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }));
      download(href, 'invitation.ics');
      setTimeout(() => URL.revokeObjectURL(href), 1000);
    },
  };
  const actions: ActionId[] = [
    ...(canShare ? (['share'] as const) : []),
    'link',
    ...(canCopyImage ? (['image'] as const) : []),
    'save',
    ...(ics ? (['calendar'] as const) : []),
  ];
  const act = async (id: ActionId) => {
    try {
      await run[id]();
      setDone(id);
    } catch (error) {
      console.error(`Invitation ${id} failed:`, error);
    }
  };

  const down = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    start.current = { x: e.clientX, y: e.clientY, lastY: e.clientY, at: e.timeStamp, speed: 0 };
    setDrag({ x: 0, y: 0, active: true });
  };
  const move = (e: ReactPointerEvent<HTMLDivElement>) => {
    const current = start.current;
    if (!current) return;
    const elapsed = e.timeStamp - current.at;
    if (elapsed > 0) current.speed = (e.clientY - current.lastY) / elapsed;
    current.lastY = e.clientY;
    current.at = e.timeStamp;
    setDrag({ x: e.clientX - current.x, y: Math.max(0, e.clientY - current.y), active: true });
  };
  const up = () => {
    const current = start.current;
    start.current = null;
    if (!current) return;
    const projected = drag.y + current.speed * 200;
    if (drag.y > CLOSE_DISTANCE || projected > CLOSE_PROJECTED) close();
    else setDrag({ x: 0, y: 0, active: false });
  };

  const fade = Math.max(0.3, 1 - drag.y / 500);
  const tilt = Math.max(-9, Math.min(9, drag.x * 0.06));
  const transform = !entered
    ? 'translateY(600px) rotate(-4deg)'
    : `translate(${drag.x * 0.28}px, ${drag.y}px) rotate(${tilt}deg)`;

  return (
    <div className="pp-ticket-screen" role="dialog" aria-modal="true" aria-label={event.title}>
      <div className="pp-ticket-backdrop" style={{ opacity: fade }}>
        {venue?.photoUrl ? (
          <>
            <img src={venue.photoUrl} alt="" />
            <span className="pp-scrim" />
          </>
        ) : (
          <span className="pp-hatch" />
        )}
      </div>
      <div className="pp-ticket-column">
        <h2 ref={wordRef} className="pp-ticket-word" style={{ fontSize: wordSize }}>
          {event.title}
        </h2>
        <div
          className="pp-ticket-card"
          data-dragging={drag.active || undefined}
          style={{ transform }}
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={up}
        >
          <div className="pp-ticket-head">
            <span>
              <KindIcon size={18} aria-hidden="true" />
              {PLAN_KIND_LABEL[locale][kind]}
            </span>
            <BrandMark />
          </div>
          <div className="pp-ticket-main">
            <small>{t.invited}</small>
            <div className="pp-ticket-title">
              <span className="pp-ticket-icon">
                <KindIcon size={26} aria-hidden="true" />
              </span>
              <h3>{event.title}</h3>
            </div>
            {venue && (
              <div className="pp-ticket-venue">
                <MapPin size={20} aria-hidden="true" />
                <div>
                  <b>{venue.name}</b>
                  <p>{venue.address}</p>
                </div>
              </div>
            )}
          </div>
          <Marquee code={`W2M-${event.id.slice(-4).toUpperCase()}`} />
          <div className="pp-ticket-stats">
            <div>
              <small>{t.when}</small>
              {when && (
                <>
                  <b className="pp-stamp pp-stamp-date">{whenText.stamp(when, locale, zone)}</b>
                  <span>{whenText.time(when, locale, zone)}</span>
                </>
              )}
            </div>
            <div>
              <small className="pp-going">{t.going}</small>
              <div className="pp-going-row">
                <b className="pp-stamp pp-going">{event.participants.length}</b>
                <AvatarStack people={event.participants} size={24} max={5} myId={myId} />
              </div>
              <span>{isOrganizer ? t.hostedByYou : t.together}</span>
            </div>
          </div>
          <div className="pp-ticket-foot">
            <span>{t.issued(whenText.issued(new Date(event.publishedAt), locale))}</span>
            <span>{t.confirmed}</span>
          </div>
        </div>
        <div className="pp-ticket-actions" style={{ opacity: fade }}>
          {actions.map((id) => {
            const Icon = done === id ? Check : ICONS[id];
            return (
              <button
                key={id}
                type="button"
                data-done={done === id || undefined}
                onClick={() => void act(id)}
              >
                <span>
                  <Icon size={21} aria-hidden="true" />
                </span>
                {t[id]}
              </button>
            );
          })}
        </div>
        <button type="button" className="pp-ticket-close" onClick={close}>
          {t.close}
        </button>
        <p className="pp-ticket-hint">{t.pull}</p>
      </div>
    </div>
  );
}
