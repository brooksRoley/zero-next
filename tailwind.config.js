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
        forest: {
          50:  '#edf7f0',
          100: '#d1ecd8',
          200: '#a3d9b1',
          300: '#6abf82',
          400: '#40916c',
          500: '#2d6a4f',
          600: '#1b4332',
          700: '#143728',
          800: '#0d2b1e',
          900: '#081f15',
          950: '#04120c',
        },
        candy: {
          50:  '#fff0f6',
          100: '#ffe0ed',
          200: '#ffb8d9',
          300: '#ff8cc2',
          400: '#ff69b4',
          500: '#f24da0',
          600: '#db2777',
          700: '#b91c5e',
          800: '#9d174d',
          900: '#831843',
          950: '#500724',
        },
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
          '0%, 100%': { boxShadow: '0 0 8px rgba(255,105,180,0.15)' },
          '50%': { boxShadow: '0 0 20px rgba(255,105,180,0.3)' },
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
