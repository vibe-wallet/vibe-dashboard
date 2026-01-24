/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: '#8b5cf6', // Purple-500
        secondary: '#a855f7', // Purple-400
        dark: '#0f0f11',
        card: '#18181b', // Zinc-900
      }
    },
  },
  plugins: [],
}
