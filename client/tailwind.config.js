/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: '#1B2A4A', dark: '#0F1D36', light: '#2D4470' },
        accent: { DEFAULT: '#E85D04', dark: '#CC4D00', light: '#FF7B2E' },
        surface: { DEFAULT: '#FFFFFF', dark: '#1C2333' },
        background: { DEFAULT: '#F3F4F8', dark: '#111827' },
        'status-draft': '#6B7280',
        'status-sent': '#2563EB',
        'status-confirmed': '#D97706',
        'status-shipped': '#EA580C',
        'status-transit': '#0369A1',
        'status-delivered': '#059669',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
