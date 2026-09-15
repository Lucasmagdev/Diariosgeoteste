/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    container: {
      center: true,
      padding: '1rem',
      screens: {
        '2xl': '1320px',
      },
    },
    extend: {
      fontFamily: {
        sans: [
          'Inter',
          'ui-sans-serif',
          'system-ui',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'Arial',
          'Noto Sans',
          'Apple Color Emoji',
          'Segoe UI Emoji',
          'Segoe UI Symbol',
        ],
      },
      colors: {
        background: 'oklch(var(--ap-background) / <alpha-value>)',
        foreground: 'oklch(var(--ap-foreground) / <alpha-value>)',
        card: {
          DEFAULT: 'oklch(var(--ap-card) / <alpha-value>)',
          foreground: 'oklch(var(--ap-card-foreground) / <alpha-value>)',
        },
        popover: {
          DEFAULT: 'oklch(var(--ap-popover) / <alpha-value>)',
          foreground: 'oklch(var(--ap-popover-foreground) / <alpha-value>)',
        },
        primary: {
          DEFAULT: 'oklch(var(--ap-primary) / <alpha-value>)',
          foreground: 'oklch(var(--ap-primary-foreground) / <alpha-value>)',
          glow: 'oklch(var(--ap-primary-glow) / <alpha-value>)',
        },
        success: {
          DEFAULT: 'oklch(var(--ap-success) / <alpha-value>)',
          foreground: 'oklch(var(--ap-success-foreground) / <alpha-value>)',
        },
        warning: 'oklch(var(--ap-warning) / <alpha-value>)',
        secondary: {
          DEFAULT: 'oklch(var(--ap-secondary) / <alpha-value>)',
          foreground: 'oklch(var(--ap-secondary-foreground) / <alpha-value>)',
        },
        muted: {
          DEFAULT: 'oklch(var(--ap-muted) / <alpha-value>)',
          foreground: 'oklch(var(--ap-muted-foreground) / <alpha-value>)',
        },
        accent: {
          DEFAULT: 'oklch(var(--ap-accent) / <alpha-value>)',
          foreground: 'oklch(var(--ap-accent-foreground) / <alpha-value>)',
        },
        destructive: {
          DEFAULT: 'oklch(var(--ap-destructive) / <alpha-value>)',
          foreground: 'oklch(var(--ap-destructive-foreground) / <alpha-value>)',
        },
        border: 'oklch(var(--ap-border) / <alpha-value>)',
        input: 'oklch(var(--ap-input) / <alpha-value>)',
        ring: 'oklch(var(--ap-ring) / <alpha-value>)',
        brand: {
          DEFAULT: '#059669',
          50: '#ecfdf5',
          100: '#d1fae5',
          200: '#a7f3d0',
          300: '#6ee7b7',
          400: '#34d399',
          500: '#10b981',
          600: '#059669',
          700: '#047857',
          800: '#065f46',
          900: '#064e3b',
        },
      },
      borderRadius: {
        xl: '0.75rem',
        '2xl': '1rem',
      },
      boxShadow: {
        card:
          '0 1px 2px 0 rgb(0 0 0 / 0.04), 0 1px 3px 0 rgb(0 0 0 / 0.1)',
        'focus-soft': '0 0 0 3px rgba(5, 150, 105, 0.1)',
        'glow-soft': '0 0 20px rgba(5, 150, 105, 0.15)',
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-in': 'slideIn 0.3s ease-out',
        'scale-in': 'scaleIn 0.2s ease-out',
        'tilt': 'tilt 0.3s ease-out',
        'glitch': 'glitch 0.5s ease-in-out',
        'float': 'float 3s ease-in-out infinite',
        'pulse-soft': 'pulseSoft 2s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideIn: {
          '0%': { opacity: '0', transform: 'translateX(100%)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        tilt: {
          '0%, 100%': { transform: 'rotate(0deg)' },
          '25%': { transform: 'rotate(1deg)' },
          '75%': { transform: 'rotate(-1deg)' },
        },
        glitch: {
          '0%, 100%': { transform: 'translate(0)' },
          '20%': { transform: 'translate(-2px, 2px)' },
          '40%': { transform: 'translate(-2px, -2px)' },
          '60%': { transform: 'translate(2px, 2px)' },
          '80%': { transform: 'translate(2px, -2px)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '0.8', transform: 'scale(1.05)' },
        },
      },
    },
  },
  plugins: [],
};
