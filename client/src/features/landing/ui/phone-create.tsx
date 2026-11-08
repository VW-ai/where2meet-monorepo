'use client';

import '@fontsource/anton/400.css';
import '@/features/meeting/ui/mobile/phone-plan.css';
import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { CalendarDays, Pencil, UserRound } from 'lucide-react';
import catLogo from '@/components/cat/logo.svg';
import { useAuthStore } from '@/features/auth/model/auth-store';
import { eventClient, participantClient } from '@/features/meeting/api';
import {
  atTime,
  defaultMeetingDate,
  isSameDay,
  onDay,
  pickerDays,
  planKind,
  PLAN_KIND_LABEL,
  stepTicker,
  tickerText,
  TIME_SLOTS,
  upcoming,
  whenLine,
  whenText,
  type Ticker,
} from '@/features/meeting/lib/phone-plan';
import {
  BrandMark,
  Cta,
  KIND_ICON,
  Marquee,
  useFittedWord,
} from '@/features/meeting/ui/mobile/phone-parts';
import { analyticsEvents } from '@/lib/analytics/events';
import { usePortalStore } from '@/features/portal/model/portal-store';
import {
  LocaleProvider,
  defineMessages,
  localeFor,
  useLocale,
  useMessages,
} from '@/shared/lib/i18n';
import { isMainlandChinaTimeZone } from '@/shared/lib/map-provider';
import { browserTimeZone } from '@/shared/lib/meeting-times';
import type { MapProvider } from '@/shared/types/map';

const messages = defineMessages({
  en: {
    tagline: 'Plan where to meet, together.',
    invited: "You're invited to",
    placeholder: 'Name your event',
    nameLabel: 'Event name',
    when: 'WHEN',
    where: 'WHERE',
    decide: 'Decide together',
    going: 'GOING',
    goingCount: '1+',
    friends: 'You and friends',
    issued: (date: string) => `ISSUED ${date}`,
    draft: 'DRAFT',
    whenTitle: 'When are you meeting?',
    change: 'Change',
    start: 'Start planning',
    nameFirst: 'Name your event to start',
    day: 'Day',
    time: 'Time',
    today: 'Today',
    other: 'Other',
    done: 'Done',
    open: 'Open an invitation',
    failed: "We couldn't create your meeting. Check your connection and try again.",
    account: 'Your account',
    switchMap: '中国',
  },
  zh: {
    tagline: '一起决定在哪见面。',
    invited: '邀请你来',
    placeholder: '给这次见面起个名字',
    nameLabel: '见面名称',
    when: '时间',
    where: '地点',
    decide: '一起决定',
    going: '人数',
    goingCount: '1+',
    friends: '你和朋友们',
    issued: (date: string) => `签发 ${date}`,
    draft: '草稿',
    whenTitle: '什么时候见面？',
    change: '修改',
    start: '开始计划',
    nameFirst: '起个名字就能开始',
    day: '日期',
    time: '时间',
    today: '今天',
    other: '其他',
    done: '完成',
    open: '打开一份邀请',
    failed: '没能创建见面。请检查网络后重试。',
    account: '你的账户',
    switchMap: 'Global',
  },
});

const WORD_SIZES = [84, 72, 62, 54, 46, 38, 32, 26];
const SHORT_SCREEN = 740;
const TITLE_MAX = 40;

function useTicker(running: boolean, locale: 'en' | 'zh') {
  const [ticker, setTicker] = useState<Ticker>({ index: 0, count: 0, deleting: false });
  useEffect(() => {
    if (!running || !window.matchMedia('(max-width: 767px)').matches) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setTicker({ index: 0, count: 99, deleting: false });
      return;
    }
    let timer: ReturnType<typeof setTimeout>;
    const tick = (current: Ticker, wait: number) => {
      timer = setTimeout(() => {
        const { next, holdMs } = stepTicker(current, locale);
        setTicker(next);
        tick(next, holdMs);
      }, wait);
    };
    tick({ index: 0, count: 0, deleting: false }, 300);
    return () => clearTimeout(timer);
  }, [running, locale]);
  return tickerText(ticker, locale);
}

function Tray({
  when,
  setWhen,
  picking,
  setPicking,
  named,
  busy,
  error,
  onStart,
}: {
  when: Date;
  setWhen: (date: Date) => void;
  picking: boolean;
  setPicking: (on: boolean) => void;
  named: boolean;
  busy: boolean;
  error: string | null;
  onStart: () => void;
}) {
  const t = useMessages(messages);
  const locale = useLocale();
  const now = new Date();
  const router = useRouter();

  if (picking) {
    const isToday = isSameDay(when, now);
    const inSlots = TIME_SLOTS.some(([h, m]) => when.getHours() === h && when.getMinutes() === m);
    const timeValue = `${String(when.getHours()).padStart(2, '0')}:${String(when.getMinutes()).padStart(2, '0')}`;
    return (
      <div className="pp-tray">
        <p className="pp-picker-label">{t.day}</p>
        <div className="pp-day-grid">
          {pickerDays(now).map((day, index) => (
            <button
              key={day.toISOString()}
              type="button"
              className="pp-day"
              aria-pressed={isSameDay(day, when)}
              onClick={() => setWhen(upcoming(onDay(when, day), now))}
            >
              <small>{index === 0 ? t.today : whenText.weekday(day, locale)}</small>
              {whenText.dayNumber(day, locale)}
            </button>
          ))}
        </div>
        <p className="pp-picker-label">{t.time}</p>
        <div className="pp-time-grid">
          {TIME_SLOTS.map(([hour, minute]) => {
            const value = atTime(when, hour, minute);
            return (
              <button
                key={`${hour}:${minute}`}
                type="button"
                className="pp-time"
                disabled={isToday && value <= now}
                aria-pressed={when.getHours() === hour && when.getMinutes() === minute}
                onClick={() => setWhen(value)}
              >
                {whenText.time(value, locale)}
              </button>
            );
          })}
          <label className="pp-time" aria-pressed={!inSlots}>
            {inSlots ? t.other : whenText.time(when, locale)}
            <input
              type="time"
              value={timeValue}
              aria-label={t.other}
              onChange={(event) => {
                const [hour, minute] = event.target.value.split(':').map(Number);
                if (!Number.isNaN(hour)) setWhen(upcoming(atTime(when, hour, minute), now));
              }}
            />
          </label>
        </div>
        <div style={{ paddingTop: 2 }}>
          <Cta onClick={() => setPicking(false)}>{t.done}</Cta>
        </div>
      </div>
    );
  }

  return (
    <div className="pp-tray">
      <button type="button" className="pp-when-card" onClick={() => setPicking(true)}>
        <span className="pp-when-tile">
          <CalendarDays size={24} aria-hidden="true" />
        </span>
        <span className="pp-when-text">
          <small>{t.whenTitle}</small>
          <b>{whenLine(when, now, locale)}</b>
        </span>
        <span className="pp-when-change">{t.change}</span>
      </button>
      <Cta disabled={!named || busy} onClick={onStart}>
        {named ? t.start : t.nameFirst}
      </Cta>
      {error && (
        <p role="alert" className="pp-tray-error">
          {error}
        </p>
      )}
      <button
        type="button"
        className="pp-tray-link"
        onClick={() => {
          const link = window.prompt(t.open);
          const id = link?.trim().split('/').filter(Boolean).pop();
          if (id) router.push(`/meet/${id}`);
        }}
      >
        {t.open}
      </button>
    </div>
  );
}

/** The first screen on a phone: the invitation you are about to send, as in the app. */
export function PhoneCreate() {
  const router = useRouter();
  const { isAuthenticated, user } = useAuthStore();
  const [mapProvider, setMapProvider] = useState<MapProvider>('google');
  const locale = localeFor(mapProvider);
  const [title, setTitle] = useState('');
  const [when, setWhen] = useState<Date | null>(null);
  const [focused, setFocused] = useState(false);
  const [picking, setPicking] = useState(false);
  const [shake, setShake] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const logoRef = useRef<HTMLImageElement>(null);
  const trimmed = title.trim();
  const [wordRef, wordSize] = useFittedWord<HTMLButtonElement>(trimmed || 'GAME NIGHT', WORD_SIZES);
  const idea = useTicker(!trimmed, locale);
  const kind = planKind(title);
  const KindIcon = KIND_ICON[kind];
  const t = messages[locale];

  useEffect(() => {
    setWhen(defaultMeetingDate(new Date()));
    if (isMainlandChinaTimeZone(browserTimeZone())) setMapProvider('amap');
  }, []);

  const start = async () => {
    if (!trimmed) {
      setShake(true);
      setTimeout(() => setShake(false), 380);
      inputRef.current?.focus();
      return;
    }
    if (busy || !when) return;
    setBusy(true);
    setError(null);
    const logo = logoRef.current?.getBoundingClientRect();
    usePortalStore
      .getState()
      .start(
        logo ? { left: logo.left, top: logo.top, width: logo.width, height: logo.height } : null
      );
    try {
      const event = await eventClient.create({
        title: trimmed,
        meetingTime: when.toISOString(),
        meetingTimeZone: browserTimeZone(),
        mapProvider,
      });
      if (event.participantToken && event.organizerParticipantId) {
        useAuthStore
          .getState()
          .setOrganizerInfo(event.id, event.participantToken, event.organizerParticipantId);
        if (user?.name) {
          await participantClient
            .update(
              event.id,
              event.organizerParticipantId,
              { name: user.name },
              event.participantToken
            )
            .catch((failure) => console.error('Could not save the organizer name:', failure));
        }
        if (isAuthenticated) {
          const { userClient } = await import('@/features/user/api');
          await userClient
            .claimEvent({ eventId: event.id, participantToken: event.participantToken })
            .catch((failure) => console.error('Could not claim the event:', failure));
        }
      }
      analyticsEvents.createEvent(event.id);
      usePortalStore.getState().created(event.id, false);
      router.push(`/meet/${event.id}`);
    } catch (failure) {
      console.error('Error creating event:', failure);
      usePortalStore.getState().fail();
      setError(t.failed);
    } finally {
      setBusy(false);
    }
  };

  const word = trimmed || idea;
  const shortPick = picking && window.innerHeight < SHORT_SCREEN;
  const nameSize = trimmed.length > 26 ? 22 : trimmed.length > 16 ? 26 : 32;
  const now = new Date();

  return (
    <LocaleProvider locale={locale}>
      <section className="pp-create-home" lang={locale === 'zh' ? 'zh-CN' : 'en'}>
        <div className="pp-create">
          <div className="pp-create-top">
            <span className="pp-hatch" />
            <div className="pp-create-line">
              <span className="pp-create-logo">
                <Image
                  ref={logoRef}
                  src={catLogo}
                  alt="Where2Meet"
                  width={44}
                  height={44}
                  className="portal-logo"
                  priority
                />
              </span>
              <p>{t.tagline}</p>
              <a
                href={isAuthenticated ? '/dashboard' : '/auth/signin'}
                className="pp-create-account"
                aria-label={t.account}
              >
                <UserRound size={21} aria-hidden="true" />
              </a>
            </div>
            <button
              ref={wordRef}
              type="button"
              className="pp-create-word"
              data-idea={!trimmed || undefined}
              style={{ fontSize: wordSize, opacity: picking ? 0 : 1 }}
              tabIndex={-1}
              aria-hidden="true"
              onClick={() => inputRef.current?.focus()}
            >
              {word}
            </button>
            <div className="pp-draft" data-shake={shake || undefined}>
              {!shortPick && (
                <div className="pp-ticket-head">
                  <span>
                    <KindIcon size={18} aria-hidden="true" />
                    {PLAN_KIND_LABEL[locale][kind]}
                  </span>
                  <BrandMark />
                </div>
              )}
              <div className="pp-draft-name">
                {!shortPick && <small>{t.invited}</small>}
                <label className="pp-draft-input" data-empty={!trimmed || undefined}>
                  <input
                    ref={inputRef}
                    value={title}
                    aria-label={t.nameLabel}
                    placeholder={t.placeholder}
                    maxLength={TITLE_MAX}
                    enterKeyHint="done"
                    style={trimmed ? { fontSize: nameSize } : undefined}
                    onFocus={() => setFocused(true)}
                    onBlur={() => setFocused(false)}
                    onChange={(event) => setTitle(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') event.currentTarget.blur();
                    }}
                  />
                  {trimmed && <Pencil size={16} aria-hidden="true" />}
                </label>
              </div>
              {!focused && !shortPick && <Marquee code="W2M-DRAFT" />}
              <div className="pp-draft-stats">
                <div>
                  <small>{t.when}</small>
                  <b className="pp-stamp pp-stamp-date">
                    {when ? whenText.stamp(when, locale) : ' '}
                  </b>
                  <span>{when ? whenText.time(when, locale) : ' '}</span>
                </div>
                <div>
                  <small>{t.where}</small>
                  <b className="pp-stamp pp-stat-where">?</b>
                  <span>{t.decide}</span>
                </div>
                <div>
                  <small className="pp-going">{t.going}</small>
                  <b className="pp-stamp pp-going">{t.goingCount}</b>
                  <span className="pp-going">{t.friends}</span>
                </div>
              </div>
              {!focused && !shortPick && (
                <div className="pp-ticket-foot">
                  <span>{t.issued(whenText.issued(now, locale))}</span>
                  <span>{t.draft}</span>
                </div>
              )}
            </div>
          </div>
          {!focused && !picking && (
            <button
              type="button"
              className="pp-china"
              onClick={() => setMapProvider(mapProvider === 'amap' ? 'google' : 'amap')}
            >
              {t.switchMap}
            </button>
          )}
          {!focused && when && (
            <Tray
              when={when}
              setWhen={setWhen}
              picking={picking}
              setPicking={setPicking}
              named={!!trimmed}
              busy={busy}
              error={error}
              onStart={() => void start()}
            />
          )}
        </div>
      </section>
    </LocaleProvider>
  );
}
