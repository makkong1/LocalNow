/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./App.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        primary: '#f59e0b',
        surface: '#1a1a1a',
        background: '#0a0a0a',
      }
    }
  },
  plugins: [],
}
