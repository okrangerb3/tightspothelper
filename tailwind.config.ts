/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans:    ['var(--font-body)', 'system-ui', 'sans-serif'],
        display: ['var(--font-display)', 'system-ui', 'sans-serif'],
        mono:    ['var(--font-mono)', 'monospace'],
      },
      colors: {
        brand: {
          50:  '#fff8ed',
          100: '#ffefd3',
          200: '#ffdba5',
          300: '#ffc06d',
          400: '#ff9a32',
          500: '#f97c0a',
          600: '#ea6200',
          700: '#c24902',
          800: '#9a3908',
          900: '#7c300b',
        },
        ink: {
          50:  '#f4f3f0',
          100: '#e4e3de',
          200: '#cac8c0',
          300: '#aaa89e',
          400: '#888680',
          500: '#6e6c66',
          600: '#575550',
          700: '#45443f',
          800: '#2d2c29',
          900: '#1a1917',
          950: '#0e0d0c',
        },
      },
      borderRadius: {
        '4xl': '2rem',
      },
      animation: {
        'fade-up':   'fadeUp .5s ease both',
        'fade-in':   'fadeIn .4s ease both',
        'shimmer':   'shimmer 2s linear infinite',
      },
      keyframes: {
        fadeUp:  { from: { opacity: 0, transform: 'translateY(16px)' }, to: { opacity: 1, transform: 'none' } },
        fadeIn:  { from: { opacity: 0 }, to: { opacity: 1 } },
        shimmer: { from: { backgroundPosition: '200% 0' }, to: { backgroundPosition: '-200% 0' } },
      },
    },
  },
  plugins: [],
}
