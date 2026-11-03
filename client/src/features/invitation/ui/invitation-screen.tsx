'use client';

import '@fontsource/anton/400.css';
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/inter/400.css';
import '@fontsource/inter/700.css';
import '@fontsource/inter/800.css';
import { useEffect, useState, type ComponentType } from 'react';
import { CalendarPlus, Check, Copy, Download, Link2, Share } from 'lucide-react';
import catLogo from '@/components/cat/logo.svg';
import { analyticsEvents } from '@/lib/analytics/events';
import { defineMessages, useMessages } from '@/shared/lib/i18n';
import { calendarFile } from '../model/calendar';
import { shareText, type Invitation } from '../model/invitation';
import { BigWord, Ticket, TicketBackdrop } from './ticket';

const messages = defineMessages({
  en: {
    dialog: 'Invitation',
    shareVia: 'Share via',
    copyLink: 'Copy link',
    copyImage: 'Copy image',
    save: 'Save',
    calendar: 'Calendar',
    copied: 'Copied',
    saved: 'Saved',
    close: 'Close',
  },
  zh: {
    dialog: '邀请',
    shareVia: '分享到',
    copyLink: '复制链接',
    copyImage: '复制图片',
    save: '保存',
    calendar: '日历',
    copied: '已复制',
    saved: '已保存',
    close: '关闭',
  },
});

type Messages = (typeof messages)['en'];

interface Action {
  id: 'share' | 'link' | 'image' | 'save' | 'calendar';
  icon: ComponentType<{ className?: string }>;
  label: keyof Messages;
  /** Shown in place of the label for a moment after it worked. */
  done?: keyof Messages;
  run: () => Promise<void> | void;
}

/** The portrait PNG, fetched up front: Safari only shares or copies files inside the tap itself. */
function usePortrait(url: string) {
  const [blob, setBlob] = useState<Promise<Blob> | null>(null);
  useEffect(() => {
    const pending = fetch(url).then((response) => {
      if (!response.ok) throw new Error(`invitation image: ${response.status}`);
      return response.blob();
    });
    pending.catch((error: unknown) => console.error(error));
    setBlob(pending);
  }, [url]);
  return blob;
}

function download(href: string, filename: string) {
  const link = document.createElement('a');
  link.href = href;
  link.download = filename;
  link.click();
}

async function copyText(value: string) {
  try {
    await navigator.clipboard.writeText(value);
    return;
  } catch {
    // Non-secure contexts have no async clipboard, and embedded browsers can deny it.
  }
  const textArea = document.createElement('textarea');
  textArea.value = value;
  textArea.style.position = 'fixed';
  textArea.style.left = '-9999px';
  document.body.appendChild(textArea);
  textArea.select();
  const copied = document.execCommand('copy');
  document.body.removeChild(textArea);
  if (!copied) throw new Error('copy command refused');
}

/**
 * The published event's share screen: the venue kind's word, the live ticket, a row of
 * share actions and Close. Full screen on a phone, a phone-sized column on desktop.
 */
export function InvitationScreen({
  invitation,
  eventId,
  onClose,
}: {
  invitation: Invitation;
  eventId: string;
  onClose: () => void;
}) {
  const t = useMessages(messages);
  const imageUrl = `/meet/${eventId}/invite.png?format=portrait`;
  const portrait = usePortrait(imageUrl);
  const [done, setDone] = useState<Action['id'] | null>(null);
  const photo = invitation.venue?.photoUrl ?? null;
  const ics = calendarFile(invitation, new Date());

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    if (!done) return;
    const timer = setTimeout(() => setDone(null), 2000);
    return () => clearTimeout(timer);
  }, [done]);

  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';
  const canCopyImage =
    typeof ClipboardItem !== 'undefined' && typeof navigator.clipboard?.write === 'function';

  const actions: Action[] = [
    ...(canShare
      ? [
          {
            id: 'share',
            icon: Share,
            label: 'shareVia',
            run: async () => {
              const data: ShareData = {
                title: invitation.title,
                text: shareText(invitation),
                url: invitation.url,
              };
              const blob = await portrait?.catch(() => null);
              const file = blob && new File([blob], 'invitation.png', { type: 'image/png' });
              if (file && navigator.canShare?.({ files: [file] })) data.files = [file];
              try {
                await navigator.share(data);
                analyticsEvents.shareEvent(eventId, 'social');
              } catch (err) {
                if (err instanceof Error && err.name === 'AbortError') return;
                throw err;
              }
            },
          } satisfies Action,
        ]
      : []),
    {
      id: 'link',
      icon: Link2,
      label: 'copyLink',
      done: 'copied',
      run: async () => {
        await copyText(invitation.url);
        analyticsEvents.shareEvent(eventId, 'link');
      },
    },
    ...(canCopyImage && portrait
      ? [
          {
            id: 'image',
            icon: Copy,
            label: 'copyImage',
            done: 'copied',
            run: () => navigator.clipboard.write([new ClipboardItem({ 'image/png': portrait })]),
          } satisfies Action,
        ]
      : []),
    {
      id: 'save',
      icon: Download,
      label: 'save',
      done: 'saved',
      run: () => download(imageUrl, 'invitation.png'),
    },
    ...(ics
      ? [
          {
            id: 'calendar',
            icon: CalendarPlus,
            label: 'calendar',
            run: () => {
              const href = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }));
              download(href, 'invitation.ics');
              setTimeout(() => URL.revokeObjectURL(href), 1000);
            },
          } satisfies Action,
        ]
      : []),
  ];

  const run = async (action: Action) => {
    try {
      await action.run();
      if (action.done) setDone(action.id);
    } catch (err) {
      console.error(`Invitation ${action.id} failed:`, err);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <style>{`
        @keyframes invitation-strip { to { transform: translateX(-50%); } }
        .invitation-strip { animation: invitation-strip 18s linear infinite; }
        @media (prefers-reduced-motion: reduce) { .invitation-strip { animation: none; } }
      `}</style>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t.dialog}
        className="relative h-full w-full overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200 sm:h-[min(844px,calc(100dvh-48px))] sm:w-[390px] sm:rounded-[44px]"
        onClick={(e) => e.stopPropagation()}
      >
        <TicketBackdrop photo={photo} />
        <div className="relative flex h-full flex-col overflow-y-auto px-[18px] pb-[max(env(safe-area-inset-bottom),24px)] pt-[max(env(safe-area-inset-top),40px)]">
          <div className="mb-7 mt-6 flex justify-center">
            <BigWord invitation={invitation} size={88} />
          </div>
          <Ticket invitation={invitation} u={1} photo={photo} cat={catLogo.src} live />
          <div className="mt-auto flex justify-between gap-1 px-0.5 pt-8">
            {actions.map((action) => {
              const Icon = done === action.id ? Check : action.icon;
              return (
                <button
                  key={action.id}
                  onClick={() => run(action)}
                  className="group flex min-w-0 flex-1 flex-col items-center gap-2 text-[12.5px] font-medium text-white"
                >
                  <span className="grid h-[58px] w-[58px] place-items-center rounded-full bg-white/20 backdrop-blur-md transition-colors group-hover:bg-white/30">
                    <Icon className="h-6 w-6" />
                  </span>
                  <span className="truncate">
                    {t[done === action.id && action.done ? action.done : action.label]}
                  </span>
                </button>
              );
            })}
          </div>
          <button
            onClick={onClose}
            className="mt-5 shrink-0 rounded-[20px] border border-white/30 py-[15px] text-center font-semibold text-white transition-colors hover:bg-white/10"
          >
            {t.close}
          </button>
        </div>
      </div>
    </div>
  );
}
