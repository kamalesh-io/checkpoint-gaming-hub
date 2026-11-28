import type { Config } from 'tailwindcss';

/**
 * CHECKPOINT V3 Cinematic Design System Tokens
 * Visual Source of Truth: V1.1.0 Reference — Console-inspired UI
 * Base: Charcoal dark surface palette
 * Typography: Plus Jakarta Sans (display/headline) + DM Sans (body/nav)
 */
const config: Config = {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        /* ── V3 Charcoal Surface System ── */
        background: '#0C0F12',
        'on-background': '#F5F5F7',
        sidebar: '#10141A',           /* Legacy alias — dock uses bg-dock now */
        'on-sidebar': '#F5F5F7',
        'secondary-background': '#14181D',
        'on-secondary-background': '#F5F5F7',
        surface: '#1A1F26',
        'on-surface': '#F5F5F7',
        'surface-elevated': '#1E2329',
        'on-surface-elevated': '#F5F5F7',
        outline: '#2A2F38',
        muted: '#A7ABB4',
        primary: '#66B8FF',
        'on-primary': '#0C0F12',

        /* ── Dynamic accent (CSS custom properties) ── */
        'accent-active': 'var(--accent-active)',
        'on-accent-active': 'var(--accent-active-ink)',

        /* ── Named accent palette ── */
        'accent-gold': '#E0B45A',
        'on-accent-gold': '#0C0F12',
        'accent-amber': '#F09B4B',
        'on-accent-amber': '#0C0F12',
        'accent-blue': '#5BA8FF',
        'on-accent-blue': '#0C0F12',
        'accent-yellow': '#F5DF4D',
        'on-accent-yellow': '#0C0F12',

        /* ── Semantic status ── */
        success: '#52D6A0',
        'on-success': '#0C0F12',
        warning: '#F4BD62',
        'on-warning': '#0C0F12',
        error: '#F16D7A',
        'on-error': '#0C0F12',

        /* ── V3 Dock ── */
        dock: '#14181D',
        'dock-border': '#2A2F38',
      },
      borderRadius: {
        sm: '8px',
        DEFAULT: '10px',
        md: '12px',
        lg: '14px',
        xl: '16px',
        '2xl': '20px',
        '3xl': '24px',
        full: '9999px',
      },
      spacing: {
        xs: '4px',
        sm: '8px',
        md: '12px',
        lg: '16px',
        xl: '24px',
        '2xl': '32px',
        '3xl': '48px',
        'dock-safe': '100px', /* Bottom padding for floating dock */
      },
      fontFamily: {
        display: ['"Plus Jakarta Sans Variable"', '"Plus Jakarta Sans"', 'sans-serif'],
        headline: ['"Plus Jakarta Sans Variable"', '"Plus Jakarta Sans"', 'sans-serif'],
        body: ['"DM Sans Variable"', '"DM Sans"', 'sans-serif'],
        label: ['"DM Sans Variable"', '"DM Sans"', 'sans-serif'],
      },
      fontSize: {
        /* ── V3 Cinematic Type Scale ── */
        'display-hero': ['72px', { lineHeight: '76px', letterSpacing: '-0.03em', fontWeight: '800' }],
        'display-lg': ['56px', { lineHeight: '62px', letterSpacing: '-0.025em', fontWeight: '700' }],
        'display-lg-mobile': ['32px', { lineHeight: '38px', letterSpacing: '-0.02em', fontWeight: '700' }],
        'display-md': ['48px', { lineHeight: '54px', letterSpacing: '-0.02em', fontWeight: '700' }],
        'display-md-mobile': ['30px', { lineHeight: '36px', letterSpacing: '-0.015em', fontWeight: '700' }],
        'headline-lg': ['32px', { lineHeight: '40px', letterSpacing: '-0.015em', fontWeight: '600' }],
        'headline-md': ['22px', { lineHeight: '28px', letterSpacing: '-0.01em', fontWeight: '600' }],
        'headline-sm': ['16px', { lineHeight: '22px', letterSpacing: '-0.005em', fontWeight: '600' }],
        'body-lg': ['16px', { lineHeight: '26px', letterSpacing: '0em', fontWeight: '400' }],
        'body-md': ['15px', { lineHeight: '22px', letterSpacing: '0em', fontWeight: '400' }],
        'body-sm': ['13px', { lineHeight: '18px', letterSpacing: '0em', fontWeight: '400' }],
        'label-lg': ['15px', { lineHeight: '20px', letterSpacing: '0em', fontWeight: '600' }],
        'label-md': ['14px', { lineHeight: '18px', letterSpacing: '0em', fontWeight: '500' }],
        'label-sm': ['13px', { lineHeight: '16px', letterSpacing: '0.01em', fontWeight: '500' }],
      },
      boxShadow: {
        card: '0 8px 24px -4px rgba(0, 0, 0, 0.5)',
        'card-hover': '0 16px 36px -2px rgba(0, 0, 0, 0.7)',
        modal: '0 25px 50px -12px rgba(0, 0, 0, 0.9)',
        dock: '0 -4px 32px -4px rgba(0, 0, 0, 0.6)',
        glow: '0 0 40px -8px rgba(var(--accent-active-rgb), 0.35)',
      },
      transitionDuration: {
        'state-change': '140ms',
        'card-hover': '200ms',
        'hero-transition': '500ms',
        'hero-crossfade': '800ms',
        'modal-enter': '240ms',
        'dock-hover': '180ms',
      },
      transitionTimingFunction: {
        'state-change': 'ease-out',
        'card-hover': 'cubic-bezier(0.2, 0, 0, 1)',
        'hero-transition': 'cubic-bezier(0.22, 1, 0.36, 1)',
        'modal-enter': 'cubic-bezier(0.2, 0, 0, 1)',
        spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
      },
      backdropBlur: {
        dock: '24px',
      },
    },
  },
  plugins: [],
};

export default config;
