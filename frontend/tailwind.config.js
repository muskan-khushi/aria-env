/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        aria: {
          bg: '#E5D9F2', // Soft lavender background
          glass: 'rgba(255, 255, 255, 0.4)', // Base translucent white
          glassHover: 'rgba(255, 255, 255, 0.5)',
          glassBorder: 'rgba(255, 255, 255, 0.6)',
          textMain: '#4A3B69', // Deep purple text for high contrast
          textMuted: '#7E6E9C',
          accent: '#A78BFA', // Vibrant purple for badges/highlights
        }
      },
      boxShadow: {
        'glass': '0 8px 32px 0 rgba(100, 80, 130, 0.1)',
        'glass-inset': 'inset 0 2px 4px 0 rgba(255, 255, 255, 0.3)',
      }
    },
  },
  plugins: [],
}