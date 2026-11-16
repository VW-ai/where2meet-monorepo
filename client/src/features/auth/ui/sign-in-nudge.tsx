'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useAuthStore } from '@/features/auth/model/auth-store';
import { NUDGE_ACTIVE_SECONDS, useSignInNudge } from '@/features/auth/model/sign-in-nudge';
import {
  GoogleSignInButton,
  isGoogleSignInEnabled,
} from '@/features/auth/ui/google-sign-in-button';
import { accountStyles as s } from '@/features/auth/ui/account-shell';
import { useUIStore } from '@/features/meeting/model/ui-store';
import { useTutorialStore } from '@/features/tutorial/model/tutorial-store';
import { usePortalStore } from '@/features/portal/model/portal-store';
import { defineMessages, useMessages } from '@/shared/lib/i18n';
import catLogo from '@/components/cat/logo.svg';

const messages = defineMessages({
  en: {
    title: 'Save this plan',
    body: 'Sign in to keep this meeting on your account and come back to it from any device.',
    email: 'Use email instead',
    later: 'Not now',
  },
  zh: {
    title: '保存这个计划',
    body: '登录后，这个见面会保存在你的账号里，换台设备也能找回。',
    email: '用邮箱注册',
    later: '以后再说',
  },
});

// Gives a key action a moment to land on screen before the prompt covers it
const AFTER_ACTION_MS = 1500;

export function SignInNudge({ eventId }: { eventId: string }) {
  const t = useMessages(messages);
  const { isAuthenticated, isAuthInitialized } = useAuthStore();
  const phase = useSignInNudge((state) => state.phase);
  const { show, dismiss, signedIn } = useSignInNudge.getState();
  const tutorialActive = useTutorialStore((state) => state.isTutorialActive);
  const modalOpen = useUIStore(
    (state) =>
      state.isShareModalOpen ||
      state.isEditEventModalOpen ||
      state.isDeleteConfirmationOpen ||
      state.isPublishModalOpen
  );
  const portalRunning = usePortalStore((state) => state.status !== 'idle');
  const signedOut = isAuthInitialized && !isAuthenticated;
  const pageBusy = tutorialActive || modalOpen || portalRunning;

  // With no key action, ask once after 30 seconds the tab was actually in view
  useEffect(() => {
    if (!signedOut) return;
    let seconds = 0;
    const timer = setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      seconds += 1;
      if (seconds >= NUDGE_ACTIVE_SECONDS) {
        clearInterval(timer);
        useSignInNudge.getState().request('time');
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [signedOut]);

  useEffect(() => {
    if (phase.status !== 'pending' || !signedOut || pageBusy) return;
    const timer = setTimeout(show, phase.trigger === 'time' ? 0 : AFTER_ACTION_MS);
    return () => clearTimeout(timer);
  }, [phase, signedOut, pageBusy, show]);

  const open = phase.status === 'open' && signedOut;

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') dismiss();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, dismiss]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-[rgba(23,37,45,0.35)] md:items-center"
      onClick={dismiss}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="sign-in-nudge-title"
        onClick={(event) => event.stopPropagation()}
        className="w-full rounded-t-[28px] bg-white px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-6 text-[#21252b] shadow-[0_-8px_32px_rgba(23,37,45,0.18)] md:max-w-sm md:rounded-[28px] md:pb-6 md:shadow-[0_8px_32px_rgba(23,37,45,0.22)]"
      >
        <Image src={catLogo} alt="" width={44} height={44} className="h-11 w-11" />
        <h2
          id="sign-in-nudge-title"
          className="mt-3 text-[22px] font-bold leading-tight tracking-[-0.6px]"
        >
          {t.title}
        </h2>
        <p className="mt-1.5 text-[15px] leading-relaxed text-[#666b73]">{t.body}</p>

        <div className="mt-5 space-y-3">
          {isGoogleSignInEnabled() && (
            <GoogleSignInButton text="continue_with" onSignedIn={signedIn} />
          )}
          <Link
            href={`/auth/signup?next=${encodeURIComponent(`/meet/${eventId}`)}`}
            className={`w-full ${s.secondaryButton}`}
          >
            {t.email}
          </Link>
        </div>

        <button
          onClick={dismiss}
          className="mt-4 w-full text-center text-sm font-semibold text-[#8b9098] hover:text-[#21252b]"
        >
          {t.later}
        </button>
      </div>
    </div>
  );
}
