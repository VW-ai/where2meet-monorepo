import { Caveat, Fraunces, Fredoka } from 'next/font/google';
import type { ThemeFont } from '../model/themes';

// Self-hosted by Next at build time, so the theme pages make no request to Google Fonts.
const rounded = Fredoka({
  subsets: ['latin'],
  weight: ['600', '700'],
  variable: '--font-nyc-rounded',
});
const hand = Caveat({ subsets: ['latin'], weight: ['700'], variable: '--font-nyc-hand' });
const serif = Fraunces({
  subsets: ['latin'],
  weight: ['600', '700'],
  variable: '--font-nyc-serif',
});

/** Classes that define every theme's display font as a CSS variable. */
export const themeFontVariables = `${rounded.variable} ${hand.variable} ${serif.variable}`;

export const DISPLAY_FONT: Record<ThemeFont, string> = {
  sans: 'inherit',
  rounded: 'var(--font-nyc-rounded)',
  hand: 'var(--font-nyc-hand)',
  serif: 'var(--font-nyc-serif)',
};

/** Caveat reads small next to the others, so it gets a larger size at each step. */
export const DISPLAY_SCALE: Record<ThemeFont, number> = {
  sans: 1,
  rounded: 1,
  hand: 1.35,
  serif: 1,
};
