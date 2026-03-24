/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        playfair: ['Playfair Display', 'serif'],
        nunito: ['Nunito', 'sans-serif'],
      },
      colors: {
        felt: {
          green: '#1a5c2a',
          dark: '#0f3d1a',
          light: '#2d7a40',
        },
        gold: '#d4a843',
      },
    },
  },
  plugins: [],
};
