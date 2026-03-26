/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Lilac Palette
        subtle: '#E2CEF3',
        lilac: '#CCAAE6',
        lavender: '#A788DC',
        wisteria: '#9673D2',
        thistle: '#7D45C6',
        mauve: '#7E42AC',
        orchid: '#6B297C',
        amethyst: '#4F1176',
        plum: '#3B165C',
      },
      fontFamily: {
        display: ['"Cormorant Garamond"', 'serif'],
        body: ['"Jost"', 'sans-serif'],
        mono: ['"Fira Code"', 'monospace'],
      },
      animation: {
        'fade-in': 'fadeIn 0.6s ease-out forwards',
        'fade-up': 'fadeUp 0.5s ease-out forwards',
        'slide-in-right': 'slideInRight 0.4s ease-out forwards',
        'pulse-soft': 'pulseSoft 2s ease-in-out infinite',
        'shimmer': 'shimmer 2s linear infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        fadeUp: {
          '0%': { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideInRight: {
          '0%': { opacity: '0', transform: 'translateX(20px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.6' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-mesh': 'radial-gradient(ellipse at 20% 50%, rgba(159,115,210,0.15) 0%, transparent 60%), radial-gradient(ellipse at 80% 20%, rgba(125,69,198,0.1) 0%, transparent 60%), radial-gradient(ellipse at 50% 80%, rgba(79,17,118,0.12) 0%, transparent 60%)',
      },
    },
  },
  plugins: [],
}