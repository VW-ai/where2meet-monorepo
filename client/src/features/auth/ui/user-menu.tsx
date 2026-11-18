'use client';

import { useState, useEffect, useRef, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { CalendarDays, Loader2, LogOut, Settings } from 'lucide-react';
import { useAuthStore } from '@/features/auth/model/auth-store';
import { CAT_HEAD_PATH } from '@/features/meeting/lib/cat-head';
import { startLoadingMeetings } from '@/features/dashboard/lib/meetings-request';

// The cat head from the logo, as a mask, so a photo takes the same shape
const CAT_HEAD_MASK = `url("data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><path d='${CAT_HEAD_PATH}'/></svg>`
)}") center / contain no-repeat`;

// The signed-in user's Google photo in the cat-head shape, or their initial on brand red
export function UserAvatar({
  size = 'md',
  onRed = false,
}: {
  size?: 'md' | 'lg';
  // A white head with a red initial, for red headers
  onRed?: boolean;
}) {
  const { user } = useAuthStore();
  const [photoFailed, setPhotoFailed] = useState(false);
  const initial = (user?.name?.trim() || user?.email || '?').charAt(0).toUpperCase();
  const box = size === 'lg' ? 'size-12 text-lg' : 'size-9 text-sm';

  if (user?.avatarUrl && !photoFailed) {
    return (
      <img
        src={user.avatarUrl}
        alt=""
        referrerPolicy="no-referrer"
        onError={() => setPhotoFailed(true)}
        style={{ mask: CAT_HEAD_MASK, WebkitMask: CAT_HEAD_MASK }}
        className={`${box} block flex-none object-cover`}
      />
    );
  }

  return (
    <span
      className={`${box} relative grid flex-none place-items-center font-bold ${onRed ? 'text-[#c83f49]' : 'text-white'}`}
    >
      <svg viewBox="0 0 100 100" aria-hidden="true" className="absolute inset-0 size-full">
        <path d={CAT_HEAD_PATH} fill={onRed ? '#fff' : '#c83f49'} />
      </svg>
      <span className="relative mt-[14%]">{initial}</span>
    </span>
  );
}

const itemClass =
  'flex w-full items-center gap-2.5 rounded-[12px] px-3 py-2.5 text-left text-sm font-medium text-[#21252b] transition-colors hover:bg-[#f4f6f8]';

export function UserMenu() {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const [isOpen, setIsOpen] = useState(false);
  const [goingTo, setGoingTo] = useState<string | null>(null);
  const [isNavigating, startNavigation] = useTransition();
  const menuRef = useRef<HTMLDivElement>(null);

  // Opening the menu (or pointing at it) fetches the account pages and meetings, so a click lands fast
  const warmUp = () => {
    router.prefetch('/dashboard');
    router.prefetch('/dashboard/settings');
    startLoadingMeetings();
  };

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  const handleLogout = async () => {
    await logout();
    setIsOpen(false);
    router.push('/');
  };

  // The menu stays open with a spinner on the item until the page is there
  const go = (path: string) => {
    setGoingTo(path);
    startNavigation(() => router.push(path));
  };
  const pending = (path: string) => isNavigating && goingTo === path;
  const itemIcon = (path: string, Icon: typeof Settings) =>
    pending(path) ? (
      <Loader2 size={16} className="animate-spin text-[#c83f49]" />
    ) : (
      <Icon size={16} className="text-[#8b9098]" />
    );

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => {
          if (!isOpen) warmUp();
          setIsOpen(!isOpen);
        }}
        onPointerEnter={warmUp}
        aria-label="Account"
        aria-expanded={isOpen}
        className="rounded-full transition-transform hover:scale-105 active:scale-95"
      >
        <UserAvatar />
      </button>

      {isOpen && (
        <div className="absolute right-0 z-50 mt-2 w-60 rounded-[18px] bg-white p-1.5 shadow-[0_8px_32px_rgba(23,37,45,0.18)]">
          <div className="px-3 pb-2.5 pt-2">
            <p className="truncate text-sm font-semibold text-[#21252b]">
              {user?.name || 'Signed in'}
            </p>
            <p className="truncate text-xs text-[#666b73]">{user?.email}</p>
          </div>
          <div className="my-1 h-px bg-[#eef1f4]" />
          <button
            onClick={() => go('/dashboard')}
            aria-busy={pending('/dashboard')}
            className={itemClass}
          >
            {itemIcon('/dashboard', CalendarDays)}
            Your meetings
          </button>
          <button
            onClick={() => go('/dashboard/settings')}
            aria-busy={pending('/dashboard/settings')}
            className={itemClass}
          >
            {itemIcon('/dashboard/settings', Settings)}
            Account
          </button>
          <div className="my-1 h-px bg-[#eef1f4]" />
          <button onClick={handleLogout} className={itemClass}>
            <LogOut size={16} className="text-[#8b9098]" />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
