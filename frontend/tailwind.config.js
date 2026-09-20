/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: '#6C63FF',
        secondary: '#FF6584',
        dark: '#1a1a2e',
        card: '#16213e',
        accent: '#0f3460',
      }
    },
  },
  plugins: [],
}
