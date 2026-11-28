import type { IconName } from '../model/themes';

interface IconProps {
  /** The main color. */
  fill: string;
  /** The second color, for a beak, a page line or a slice's topping. */
  detail: string;
  className?: string;
}

/** Each icon's box, so a pin can anchor its tip at the bottom center. */
export const ICON_VIEWBOX: Record<IconName, { width: number; height: number }> = {
  duck: { width: 44, height: 42 },
  cup: { width: 40, height: 46 },
  umbrella: { width: 40, height: 48 },
  notebook: { width: 48, height: 48 },
  rain: { width: 48, height: 48 },
  laptop: { width: 48, height: 48 },
  pizza: { width: 48, height: 48 },
};

const DRAW: Record<IconName, (props: Omit<IconProps, 'className'>) => React.ReactNode> = {
  duck: ({ fill, detail }) => (
    <>
      <path
        d="M22 41c-1.2 0-2-1-2.6-2.2L17 34H9a6 6 0 0 1-6-6c0-1 .3-2 .8-2.8C5.7 21 9.6 19 14 19h2.5a8 8 0 1 1 13.8-6.6l5.7 1.1c.9.2 1.2 1.3.5 1.9l-3.3 2.7A9 9 0 0 1 35 23v3a8 8 0 0 1-8 8l-2.4 4.8C24 40 23.2 41 22 41z"
        fill={fill}
        stroke="#fff"
        strokeWidth="2.4"
        strokeLinejoin="round"
      />
      <path d="M30.4 12.6l5.6 1.1-3.6 3" fill={detail} />
      <circle cx="25.5" cy="10.5" r="1.9" fill="#1f3b36" />
      <path
        d="M12 25c3 3.5 9 3.5 12 0"
        fill="none"
        stroke="#fff"
        strokeWidth="1.6"
        strokeLinecap="round"
        opacity=".8"
      />
    </>
  ),
  cup: ({ fill, detail }) => (
    <>
      <path
        d="M20 45l-5.5-7H9a6 6 0 0 1-6-6V10a6 6 0 0 1 6-6h22a6 6 0 0 1 6 6v22a6 6 0 0 1-6 6h-5.5z"
        fill={fill}
        stroke="#fff"
        strokeWidth="2.4"
        strokeLinejoin="round"
      />
      <path d="M11 15h14v7a6 6 0 0 1-6 6h-2a6 6 0 0 1-6-6z" fill={detail} />
      <path d="M25 17h2a3 3 0 0 1 0 6h-2" fill="none" stroke={detail} strokeWidth="2" />
      <path
        d="M15 9.5c0 1.5 1.5 1.5 1.5 3M19.5 9.5c0 1.5 1.5 1.5 1.5 3"
        fill="none"
        stroke={detail}
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </>
  ),
  umbrella: ({ fill, detail }) => (
    <>
      <path
        d="M20 47l-6-8.2A18 18 0 1 1 26 38.8z"
        fill={fill}
        stroke="#fff"
        strokeWidth="2.4"
        strokeLinejoin="round"
      />
      <path
        d="M9 21.5a11 11 0 0 1 22 0c-1.4-1.3-2.8-1.3-4.2 0-1.4-1.3-2.8-1.3-4.2 0-1.4-1.3-2.8-1.3-4.2 0-1.4-1.3-2.8-1.3-4.2 0-1.4-1.3-2.8-1.3-5.2 0z"
        fill={detail}
      />
      <path
        d="M20 21.5v7.5a2.2 2.2 0 0 1-4.4 0"
        fill="none"
        stroke={detail}
        strokeWidth="2"
        strokeLinecap="round"
      />
    </>
  ),
  notebook: ({ fill, detail }) => (
    <>
      <rect x="6" y="9" width="36" height="30" rx="3" fill="#fff" stroke={fill} strokeWidth="2.2" />
      <path d="M24 11v26" stroke={fill} strokeWidth="2" />
      <path
        d="M10 16h10M10 21h10M10 26h8M28 16h10M28 21h10M28 26h8"
        stroke={detail}
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </>
  ),
  rain: ({ fill, detail }) => (
    <>
      <path
        d="M8 24a16 16 0 0 1 32 0c-2-1.8-4-1.8-6 0-2-1.8-4-1.8-6 0-2-1.8-4-1.8-6 0-2-1.8-4-1.8-6 0-2.4-1.8-5-1.8-8 0z"
        fill={fill}
      />
      <path
        d="M24 24v11a3 3 0 0 1-6 0"
        fill="none"
        stroke={detail}
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      <path
        d="M10 30l-1.5 4M14 36l-1.5 4M36 30l-1.5 4M40 36l-1.5 4M31 38l-1.5 4"
        stroke={detail}
        strokeWidth="2"
        strokeLinecap="round"
        opacity=".7"
      />
    </>
  ),
  laptop: ({ fill, detail }) => (
    <>
      <rect x="9" y="11" width="30" height="20" rx="2.5" fill={fill} />
      <rect x="12" y="14" width="24" height="14" rx="1" fill={detail} />
      <path d="M5 34h38l-3 4H8z" fill={fill} />
    </>
  ),
  pizza: ({ fill, detail }) => (
    <>
      <path d="M8 12c10-5 22-5 32 0L24 42z" fill={fill} />
      <path
        d="M8 12c10-5 22-5 32 0"
        fill="none"
        stroke={detail}
        strokeWidth="4"
        strokeLinecap="round"
      />
      <circle cx="20" cy="18" r="2.6" fill={detail} />
      <circle cx="28" cy="22" r="2.6" fill={detail} />
      <circle cx="23" cy="29" r="2.2" fill={detail} />
    </>
  ),
};

export function ThemeIcon({ name, fill, detail, className }: IconProps & { name: IconName }) {
  const { width, height } = ICON_VIEWBOX[name];
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      {DRAW[name]({ fill, detail })}
    </svg>
  );
}
