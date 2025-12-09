import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        coral: {
          50: '#FFF5F5',
          100: '#FFE5E5',
          200: '#FFCCCC',
          300: '#FFB3B3',
          400: '#FF8A8A',
          500: '#FF6B6B',
          600: '#EE5A5A',
          700: '#DD4949',
          800: '#CC3838',
          900: '#BB2727',
        },
        mint: {
          50: '#F0FDF4',
          100: '#DCFCE7',
          200: '#BBF7D0',
          300: '#86EFAC',
          400: '#6BCB77',
          500: '#5BB968',
          600: '#4BA759',
          700: '#3B954A',
          800: '#2B833B',
          900: '#1B712C',
        },
        sunshine: {
          50: '#FFFBEB',
          100: '#FFF7CC',
          200: '#FFF3AA',
          300: '#FFEF88',
          400: '#FFE766',
          500: '#FFD93D',
          600: '#E6C337',
          700: '#CCAD31',
          800: '#B3972B',
          900: '#998125',
        },
        lavender: {
          50: '#F5F3FF',
          100: '#EDE9FE',
          200: '#DDD6FE',
          300: '#C4B5FD',
          400: '#A8A4FF',
          500: '#9690F0',
          600: '#847CE1',
          700: '#7268D2',
          800: '#6054C3',
          900: '#4E40B4',
        },
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      keyframes: {
        'flash-pulse': {
          '0%, 100%': { transform: 'scale(1)', opacity: '1' },
          '16.67%': { transform: 'scale(1.15)', opacity: '0.85' },
          '33.33%': { transform: 'scale(1)', opacity: '1' },
          '50%': { transform: 'scale(1.15)', opacity: '0.85' },
          '66.67%': { transform: 'scale(1)', opacity: '1' },
          '83.33%': { transform: 'scale(1.15)', opacity: '0.85' },
        },
      },
      animation: {
        'flash-pulse': 'flash-pulse 600ms ease-in-out',
      },
    },
  },
  plugins: [],
};

export default config;
