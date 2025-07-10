/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./src/**/*.{js,ts,jsx,tsx}",
    "./index.html",
  ],
  theme: {
    extend: {
      colors: {
        grayblue: '#90A4AB',
        darkblue: '#274D5B',
        teal: '#0FC1E9',
        darkestblue: '#143D4D',
      },
      fontFamily: {
        exo: ['"Exo"', 'sans-serif'],
        montserrat: ['"Montserrat"', 'sans-serif'],
      },
      boxShadow: {
        whiteGlow: "0 0 20px rgba(255, 255, 255, 0.5)",
      },
    },
  },
  plugins: [],
}

