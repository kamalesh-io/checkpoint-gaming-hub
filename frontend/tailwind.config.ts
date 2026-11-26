import type { Config } from 'tailwindcss';

/**
 * CHECKPOINT V2 Design System Tokens
 * Visual Source of Truth: Google Stitch Project 16645222145573679933 (node_6193931847565035227)
 */
const config: Config = {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        background: '#111722',
        'on-background': '#F4F7FC',
        sidebar: '#151D2A',
        'on-sidebar': '#F4F7FC',
        'secondary-background': '#1B2636',
        'on-secondary-background': '#F4F7FC',
        surface: '#222E40',
        'on-surface': '#F4F7FC',
        'surface-elevated': '#2B384B',
        'on-surface-elevated': '#F4F7FC',
        outline: '#2C394D',
        muted: '#A8B5C7',
        primary: '#66B8FF',
        'on-primary': '#111722',
        'accent-active': 'var(--accent-active)',
        'on-accent-active': 'var(--accent-active-ink)',
        'accent-gold': '#E0B45A',
        'on-accent-gold': '#111722',
        'accent-amber': '#F09B4B',
        'on-accent-amber': '#111722',
        'accent-blue': '#5BA8FF',
        'on-accent-blue': '#111722',
        'accent-yellow': '#F5DF4D',
        'on-accent-yellow': '#111722',
        success: '#52D6A0',
        'on-success': '#111722',
        warning: '#F4BD62',
        'on-warning': '#111722',
        error: '#F16D7A',
        'on-error': '#111722',
      },
      borderRadius: {
        sm: '8px',
        DEFAULT: '10px',
        md: '12px',
        lg: '14px',
        xl: '16px',
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
      },
      fontFamily: {
        display: ['"Sora Variable"', '"Sora"', 'sans-serif'],
        headline: ['"Sora Variable"', '"Sora"', 'sans-serif'],
        body: ['"Inter Variable"', '"Inter"', 'sans-serif'],
        label: ['"Inter Variable"', '"Inter"', 'sans-serif'],
      },
      fontSize: {
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
        card: '0 8px 24px -4px rgba(0, 0, 0, 0.4)',
        'card-hover': '0 16px 36px -2px rgba(0, 0, 0, 0.65)',
        modal: '0 25px 50px -12px rgba(0, 0, 0, 0.85)',
      },
      transitionDuration: {
        'state-change': '140ms',
        'card-hover': '200ms',
        'hero-transition': '500ms',
        'modal-enter': '240ms',
      },
      transitionTimingFunction: {
        'state-change': 'ease-out',
        'card-hover': 'cubic-bezier(0.2, 0, 0, 1)',
        'hero-transition': 'cubic-bezier(0.22, 1, 0.36, 1)',
        'modal-enter': 'cubic-bezier(0.2, 0, 0, 1)',
      },
    },
  },
  plugins: [],
};

export default config;
