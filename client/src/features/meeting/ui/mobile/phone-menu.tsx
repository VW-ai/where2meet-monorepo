'use client';

import Link from 'next/link';
import { Home, Pencil, RefreshCw, Satellite, Trash2, UserRound, X } from 'lucide-react';
import { useAuthStore } from '@/features/auth/model/auth-store';
import { eventClient } from '@/features/meeting/api';
import { useMeetingStore } from '@/features/meeting/model/meeting-store';
import { phonePlan, usePhonePlanStore } from '@/features/meeting/model/phone-plan-store';
import { useUIStore } from '@/features/meeting/model/ui-store';
import { defineMessages, useMessages } from '@/shared/lib/i18n';

const messages = defineMessages({
  en: {
    meeting: 'Meeting',
    close: 'Close',
    satellite: 'Satellite map',
    refresh: 'Refresh',
    rename: 'Edit name and time',
    remove: 'Delete meeting',
    account: 'Your account',
    home: 'Back to home',
  },
  zh: {
    meeting: '这次见面',
    close: '关闭',
    satellite: '卫星地图',
    refresh: '刷新',
    rename: '修改名字和时间',
    remove: '删除这次见面',
    account: '你的账户',
    home: '回到首页',
  },
});

export function PhoneMenu() {
  const t = useMessages(messages);
  const event = useMeetingStore((state) => state.currentEvent);
  const satellite = usePhonePlanStore((state) => state.satellite);
  const isOrganizer = useAuthStore((state) => !!state.organizerParticipantId);
  const signedIn = useAuthStore((state) => state.isAuthenticated);
  const close = () => usePhonePlanStore.setState({ menuOpen: false });

  return (
    <div className="pp-menu-veil" onClick={close}>
      <div
        className="pp-menu"
        role="dialog"
        aria-modal="true"
        aria-label={t.meeting}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="pp-panel-head">
          <div>
            <h2>{event?.title}</h2>
            <small>{event?.id}</small>
          </div>
          <button type="button" className="pp-round" aria-label={t.close} onClick={close}>
            <X size={20} aria-hidden="true" />
          </button>
        </div>
        <label className="pp-menu-row">
          <Satellite aria-hidden="true" />
          <span>{t.satellite}</span>
          <input
            type="checkbox"
            role="switch"
            checked={satellite}
            onChange={(e) => phonePlan.setSatellite(e.target.checked)}
          />
        </label>
        <button
          type="button"
          className="pp-menu-row"
          onClick={async () => {
            if (event) useMeetingStore.getState().setCurrentEvent(await eventClient.get(event.id));
            close();
          }}
        >
          <RefreshCw aria-hidden="true" />
          <span>{t.refresh}</span>
        </button>
        {isOrganizer && (
          <>
            <button
              type="button"
              className="pp-menu-row"
              onClick={() => {
                close();
                useUIStore.getState().openEditEventModal();
              }}
            >
              <Pencil aria-hidden="true" />
              <span>{t.rename}</span>
            </button>
            <button
              type="button"
              className="pp-menu-row pp-danger"
              onClick={() => {
                close();
                useUIStore.getState().openDeleteConfirmation();
              }}
            >
              <Trash2 aria-hidden="true" />
              <span>{t.remove}</span>
            </button>
          </>
        )}
        <Link href={signedIn ? '/dashboard' : '/auth/signin'} className="pp-menu-row">
          <UserRound aria-hidden="true" />
          <span>{t.account}</span>
        </Link>
        <Link href="/" className="pp-menu-row">
          <Home aria-hidden="true" />
          <span>{t.home}</span>
        </Link>
      </div>
    </div>
  );
}
