import { CAT_HEAD_PATH } from '@/features/meeting/lib/cat-head';

/**
 * The small loading indicator: a line running around the logo's cat-head outline.
 * For small waits only (a button, a menu item, a line of text), not whole pages.
 * `onColor` draws it in the text color, for red buttons and other filled backgrounds.
 */
export function CatLoader({
  size = 16,
  onColor = false,
  className = '',
}: {
  size?: number;
  onColor?: boolean;
  className?: string;
}) {
  // Small sizes need a thicker line to stay readable
  const small = size < 28;
  return (
    <svg
      width={size}
      height={size}
      viewBox={small ? '-6 -6 112 112' : '-4 -4 108 108'}
      fill="none"
      strokeWidth={small ? 12 : 7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={`flex-none ${className}`}
    >
      <path
        d={CAT_HEAD_PATH}
        pathLength={100}
        stroke={onColor ? 'currentColor' : '#d9dee4'}
        strokeOpacity={onColor ? 0.3 : 1}
      />
      <path
        d={CAT_HEAD_PATH}
        pathLength={100}
        stroke={onColor ? 'currentColor' : '#c83f49'}
        className="cat-trace-line"
      />
    </svg>
  );
}
