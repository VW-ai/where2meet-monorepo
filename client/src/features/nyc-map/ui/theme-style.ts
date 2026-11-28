import type { CSSProperties } from 'react';
import type { LiveTheme } from '../model/themes';
import { DISPLAY_FONT, DISPLAY_SCALE } from './fonts';

/** The theme's colors and display font as CSS variables, for classes like `text-[var(--ink)]`. */
export function themeStyle(theme: LiveTheme): CSSProperties {
  const { palette } = theme;
  return {
    '--ink': palette.ink,
    '--muted': palette.muted,
    '--soft': palette.soft,
    '--accent': palette.accent,
    '--accent-ink': palette.accentInk,
    '--land': palette.land,
    '--road': palette.road,
    '--display': DISPLAY_FONT[theme.font],
    '--display-scale': DISPLAY_SCALE[theme.font],
  } as CSSProperties;
}

/** Graph paper lines, for a theme whose pattern is `grid`. */
export function gridBackground(color: string, size: number): CSSProperties {
  return {
    backgroundImage: `linear-gradient(${color} 1px, transparent 1px), linear-gradient(90deg, ${color} 1px, transparent 1px)`,
    backgroundSize: `${size}px ${size}px`,
  };
}
