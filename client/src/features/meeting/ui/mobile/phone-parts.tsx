'use client';

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Coffee, MapPin, Utensils, Wine, type LucideIcon } from 'lucide-react';
import Image from 'next/image';
import catLogo from '@/components/cat/logo.svg';
import type { Participant } from '@/entities';
import {
  avatarTint,
  fittedWordSize,
  initials,
  type PlanKind,
} from '@/features/meeting/lib/phone-plan';
import { CAT_HEAD_PATH } from '@/features/meeting/lib/cat-head';
import { useToastStore } from '@/features/meeting/model/toast-store';
import { defineMessages, useMessages } from '@/shared/lib/i18n';

const messages = defineMessages({
  en: { you: 'You' },
  zh: { you: '我' },
});

const LETTER_SPACING = 1;

/** Sizes the big word from its own box, with the font it really renders in. */
export function useFittedWord<T extends HTMLElement>(text: string, sizes: readonly number[]) {
  const ref = useRef<T>(null);
  const [size, setSize] = useState(sizes[sizes.length - 1]);

  useEffect(() => {
    const element = ref.current;
    const context = document.createElement('canvas').getContext('2d');
    if (!element || !context) return;
    const fit = () => {
      const family = getComputedStyle(element).fontFamily;
      setSize(
        fittedWordSize(
          text,
          sizes,
          { width: element.clientWidth, height: element.clientHeight },
          (value, candidate) => {
            context.font = `${candidate}px ${family}`;
            return context.measureText(value).width + value.length * LETTER_SPACING;
          }
        )
      );
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(element);
    void document.fonts.ready.then(fit);
    return () => observer.disconnect();
  }, [text, sizes]);

  return [ref, size] as const;
}

export function useYouLabel() {
  return useMessages(messages).you;
}

export function Avatar({
  person,
  size,
  isYou,
}: {
  person: Pick<Participant, 'name' | 'color'>;
  size: number;
  isYou?: boolean;
}) {
  const you = useYouLabel();
  const style: CSSProperties = {
    width: size,
    height: size,
    fontSize: size * 0.37,
    background: avatarTint(person.color),
  };
  return (
    <span className="pp-avatar" style={style} aria-hidden="true">
      {isYou ? you : initials(person.name)}
    </span>
  );
}

export function AvatarStack({
  people,
  size,
  max,
  myId,
}: {
  people: readonly Participant[];
  size: number;
  max: number;
  myId?: string | null;
}) {
  return (
    <span className="pp-stack">
      {people.slice(0, max).map((person) => (
        <Avatar key={person.id} person={person} size={size} isYou={person.id === myId} />
      ))}
    </span>
  );
}

export function CatMark({ size, color = '#21252B' }: { size: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true">
      <path d={CAT_HEAD_PATH} fill={color} />
    </svg>
  );
}

export function BrandMark({ color = '#BC3942' }: { color?: string }) {
  return (
    <span className="pp-brand" style={{ color }}>
      <Image src={catLogo} alt="" width={24} height={24} />
      where2meet
    </span>
  );
}

export const KIND_ICON: Record<PlanKind, LucideIcon> = {
  coffee: Coffee,
  drinks: Wine,
  food: Utensils,
  meetup: MapPin,
};

export function Marquee({ code, tall }: { code: string; tall?: boolean }) {
  const unit = (
    <>
      <span className="pp-strip-code">{code}</span>
      <b>where2meet</b>
    </>
  );
  return (
    <div className={`pp-strip${tall ? ' pp-strip-tall' : ''}`} aria-hidden="true">
      <div className="pp-strip-run">
        {Array.from({ length: 6 }, (_, index) => (
          <span key={index} className="pp-strip-unit">
            {unit}
          </span>
        ))}
      </div>
    </div>
  );
}

export function Cta({
  children,
  disabled,
  onClick,
}: {
  children: ReactNode;
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <button type="button" className="pp-cta" data-off={disabled || undefined} onClick={onClick}>
      {children}
    </button>
  );
}

export function PhoneToast() {
  const { toast, dismissToast } = useToastStore();
  if (!toast) return null;
  return (
    <div role="status" className="pp-toast">
      <span>{toast.message}</span>
      {toast.action && (
        <button
          type="button"
          onClick={() => {
            dismissToast();
            toast.action?.run();
          }}
        >
          {toast.action.label}
        </button>
      )}
    </div>
  );
}
