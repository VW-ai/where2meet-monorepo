import Link from 'next/link';
import { themePath, type LiveTheme, type Theme } from '../model/themes';
import { DISPLAY_FONT, DISPLAY_SCALE } from './fonts';
import { ThemeIcon } from './icons';
import { gridBackground } from './theme-style';

const tileBase =
  'relative flex min-h-[150px] flex-col justify-between gap-3 overflow-hidden rounded-[22px] p-4 sm:min-h-[200px] sm:p-5';

/** One tile per theme. Live themes link to their map; the rest say Coming soon. */
export function ThemeTiles({ themes }: { themes: readonly Theme[] }) {
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
      {themes.map((theme) => (
        <li key={theme.slug}>
          {theme.status === 'live' ? <LiveTile theme={theme} /> : <SoonTile theme={theme} />}
        </li>
      ))}
    </ul>
  );
}

function LiveTile({ theme }: { theme: LiveTheme }) {
  const { palette } = theme;
  return (
    <Link
      href={themePath(theme)}
      className={`${tileBase} group shadow-[0_2px_12px_rgba(23,37,45,0.1)] transition-[box-shadow,translate] duration-200 [transition-timing-function:cubic-bezier(.23,1,.32,1)] hover:-translate-y-1 hover:shadow-[0_12px_30px_rgba(23,37,45,0.18)] focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#b73540] motion-reduce:transition-none motion-reduce:hover:translate-y-0`}
      style={{
        backgroundColor: palette.tile,
        color: palette.tileInk,
        ...(theme.pattern === 'grid' ? gridBackground(palette.road, 14) : {}),
      }}
    >
      <span
        className="relative max-w-[75%] font-bold leading-none"
        style={{
          fontFamily: DISPLAY_FONT[theme.font],
          fontSize: `${22 * DISPLAY_SCALE[theme.font]}px`,
        }}
      >
        {theme.name}
      </span>
      <span className="relative max-w-[62%] text-[13px] leading-snug">
        {/* Phone tiles are narrow, so the name, the art and the count carry them. */}
        <span className="hidden opacity-85 sm:block">{theme.line}</span>
        <span className="block font-semibold sm:mt-1">{theme.places.length} places</span>
      </span>
      <ThemeIcon
        name={theme.marker}
        fill={palette.pin}
        detail={palette.pinDetail}
        className="absolute -bottom-1.5 -right-1.5 h-[84px] w-[84px] transition-transform duration-300 group-hover:-rotate-6 motion-reduce:transition-none sm:h-[100px] sm:w-[100px]"
      />
    </Link>
  );
}

function SoonTile({ theme }: { theme: Theme }) {
  return (
    <div className={`${tileBase} bg-[#eceef1] text-[#6b717a]`}>
      <span className="relative text-[20px] font-bold leading-none">{theme.name}</span>
      <span className="relative max-w-[62%] text-[13px] leading-snug">
        <span className="hidden sm:block">{theme.line}</span>
        <span className="block font-semibold sm:mt-1">Coming soon</span>
      </span>
      <ThemeIcon
        name={theme.marker}
        fill="#c9cdd3"
        detail="#eceef1"
        className="absolute -bottom-1.5 -right-1.5 h-[72px] w-[72px] sm:h-[88px] sm:w-[88px]"
      />
    </div>
  );
}
