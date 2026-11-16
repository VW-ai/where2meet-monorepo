'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { CalendarDays, LogOut, Settings } from 'lucide-react';
import { useAuthStore } from '@/features/auth/model/auth-store';

function initials(name: string | null | undefined, email: string | undefined) {
  if (name?.trim()) {
    return name
      .trim()
      .split(/\s+/)
      .map((part) => part[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }
  return email?.[0]?.toUpperCase() || 'U';
}

// The signed-in user's Google photo, or their initials
export function UserAvatar({ size = 'md' }: { size?: 'md' | 'lg' }) {
  const { user } = useAuthStore();
  const [photoFailed, setPhotoFailed] = useState(false);
  const box = size === 'lg' ? 'h-12 w-12 text-base' : 'h-9 w-9 text-xs';

  if (user?.avatarUrl && !photoFailed) {
    return (
      <img
        src={user.avatarUrl}
        alt=""
        referrerPolicy="no-referrer"
        onError={() => setPhotoFailed(true)}
        className={`${box} rounded-full object-cover`}
      />
    );
  }
  return (
    <span
      className={`${box} grid place-items-center rounded-full bg-[#c83f49] font-semibold text-white`}
    >
      {initials(user?.name, user?.email)}
    </span>
  );
}

const itemClass =
  'flex w-full items-center gap-2.5 rounded-[12px] px-3 py-2.5 text-left text-sm font-medium text-[#21252b] transition-colors hover:bg-[#f4f6f8]';

export function UserMenu() {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

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

  const go = (path: string) => {
    setIsOpen(false);
    router.push(path);
  };

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Account"
        aria-expanded={isOpen}
        className="rounded-full ring-offset-2 transition-shadow hover:ring-2 hover:ring-white"
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
          <button onClick={() => go('/dashboard')} className={itemClass}>
            <CalendarDays size={16} className="text-[#8b9098]" />
            Your meetings
          </button>
          <button onClick={() => go('/dashboard/settings')} className={itemClass}>
            <Settings size={16} className="text-[#8b9098]" />
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
