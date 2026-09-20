/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: '#EAB308',      // Warm solar gold
        primaryDark: '#CA8A04',  // Amber gold
        secondary: '#F97316',    // Solar orange
        dark: '#F8FAFC',         // Crisp clean light background
        card: '#FFFFFF',         // Pure white card surfaces
        accent: '#F1F5F9',       // Light slate subtle accent
        surfaceBorder: '#E2E8F0',// Soft elegant borders
      }
    },
  },
  plugins: [],
}
