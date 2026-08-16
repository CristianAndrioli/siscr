/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['Sora', 'system-ui', 'sans-serif'],
        sans: ['Instrument Sans', 'system-ui', 'sans-serif'],
      },
      colors: {
        brand: {
          50: '#f2f5fc',
          100: '#e6eafa',
          400: '#6f8ae2',
          500: '#4064d8',
          600: '#274abf',
          700: '#203d9d',
          900: '#152866',
        },
      },
      borderRadius: { control: '9px' },
    },
  },
  plugins: [],
}
