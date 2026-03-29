/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./pages/**/*.{js,jsx}",
    "./components/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: '#1b2421',
        secondary: '#2c3733',
        accent: '#c98c52',
        paper: '#f4efe7',
        ink: '#18201e',
        panel: '#121816',
        card: '#202925',
      },
      fontFamily: {
        display: ['"Iowan Old Style"', '"Palatino Linotype"', '"Book Antiqua"', 'Georgia', 'serif'],
        sans: ['"Aptos"', '"Segoe UI"', '"Helvetica Neue"', 'Arial', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
