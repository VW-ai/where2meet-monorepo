import type { Participant } from '@/entities';
import { getHexColor } from '@/features/meeting/lib/participant-colors';
import { cn } from '@/shared/lib/cn';

const BUTTON_BASE =
  'inline-flex h-10 items-center justify-center gap-[7px] whitespace-nowrap rounded-full px-3.5 text-[13.5px] font-semibold transition-[background-color,transform] duration-150 active:scale-[.97] disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-v2-ink [&_svg]:size-[15px] [&_svg]:flex-none';

export const BUTTON = {
  ink: cn(BUTTON_BASE, 'bg-v2-ink text-white hover:bg-black'),
  line: cn(
    BUTTON_BASE,
    'bg-white text-v2-ink shadow-[inset_0_0_0_1px_var(--color-v2-line)] hover:bg-v2-wash'
  ),
  ghost: cn(BUTTON_BASE, 'bg-white/15 text-white hover:bg-white/25'),
  radiant: cn(BUTTON_BASE, 'rad-border'),
  like: cn(
    BUTTON_BASE,
    'bg-white text-v2-ink shadow-[inset_0_0_0_1px_var(--color-v2-line)] hover:bg-v2-coral-wash'
  ),
  liked: cn(
    BUTTON_BASE,
    'bg-v2-coral-wash text-v2-coral-deep shadow-[inset_0_0_0_1px_#ffc9c7] [&_svg]:fill-current'
  ),
};

export const BUTTON_SMALL = 'h-8 px-[11px] text-[12.5px]';

export function initialOf(name: string): string {
  return Array.from(name.trim())[0]?.toUpperCase() ?? '?';
}

export function ParticipantAvatar({
  participant,
  ghost = false,
  small = false,
  large = false,
}: {
  participant: Pick<Participant, 'name' | 'color'>;
  ghost?: boolean;
  small?: boolean;
  large?: boolean;
}) {
  return (
    <span
      className={cn(
        'grid flex-none place-items-center rounded-full font-bold shadow-[0_0_0_2px_var(--color-v2-paper)]',
        small ? 'size-[18px] text-[9px]' : large ? 'size-8 text-[13px]' : 'size-6 text-[10.5px]',
        ghost ? 'bg-[#ebe8e3] text-[#a9a7a2]' : 'text-white'
      )}
      style={ghost ? undefined : { backgroundColor: getHexColor(participant.color) }}
      title={participant.name}
    >
      {initialOf(participant.name)}
    </span>
  );
}

export function AvatarStack({ children }: { children: React.ReactNode }) {
  return <span className="flex flex-none [&>*+*]:-ml-1.5">{children}</span>;
}
