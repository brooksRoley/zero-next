/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx}',
    './src/components/**/*.{js,ts,jsx,tsx}',
    './src/app/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Ink & Brass (2026-10-23): burnt-blue base, cream and gray text, brass
        // accent. Each step keeps the contrast of the forest/candy step it replaced.
        ink: {
          50:  '#FFFFFF',
          100: '#F5F2ED',
          200: '#DED9CE',
          300: '#BCB8B3',
          400: '#848D96',
          500: '#5A687C',
          600: '#2F3C50',
          700: '#243145',
          800: '#192739',
          900: '#1A2638',
          950: '#101B2B',
        },
        void: {
          50:  '#f5f3ff',
          100: '#ede9fe',
          200: '#ddd6fe',
          300: '#c4b5fd',
          400: '#a78bfa',
          500: '#8b5cf6',
          600: '#7c3aed',
          700: '#6d28d9',
          800: '#5b21b6',
          900: '#4c1d95',
          950: '#2e1065',
        },
        brass: {
          50:  '#FAF3E9',
          100: '#F4E6D1',
          200: '#E9D6B9',
          300: '#D8B783',
          400: '#CDA35F',
          500: '#C18E3D',
          600: '#966F2F',
          700: '#7C5B27',
          800: '#684D21',
          900: '#57411C',
          950: '#312410',
        },
        charcoal: '#262A30',
        clay: { 400: '#C9754F', 500: '#B5643F' },
      },
      backgroundImage: {
        'br-logo-box': "url('/BRLogoBox.png')",
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic':
          'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(-4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        heroFade: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        revealUp: {
          '0%': { opacity: '0', transform: 'translateY(24px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideDown: {
          '0%': { opacity: '0', maxHeight: '0' },
          '100%': { opacity: '1', maxHeight: '400px' },
        },
        glow: {
          '0%, 100%': { boxShadow: '0 0 8px rgba(205,163,95,0.15)' },
          '50%': { boxShadow: '0 0 20px rgba(205,163,95,0.3)' },
        },
        stonePop: {
          '0%': { transform: 'scale(0)', opacity: '0' },
          '60%': { transform: 'scale(1.2)' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
      },
      animation: {
        fadeIn: 'fadeIn 0.15s ease-out',
        'hero-1': 'heroFade 0.7s ease-out 0.1s both',
        'hero-2': 'heroFade 0.7s ease-out 0.3s both',
        'hero-3': 'heroFade 0.7s ease-out 0.5s both',
        'reveal': 'revealUp 0.5s ease-out both',
        'slide-down': 'slideDown 0.2s ease-out both',
        'glow': 'glow 2s ease-in-out infinite',
        'stone-pop': 'stonePop 0.2s ease-out both',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
