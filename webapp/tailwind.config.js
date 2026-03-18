/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./pages/**/*.{js,jsx}",
    "./components/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: '#0B2545',    // dark navy blue for backgrounds
        secondary: '#13315C',  // slightly lighter navy for cards
        accent: '#FF7D00',     // warm orange accent inspired by Wasatch Yard
      },
    },
  },
  plugins: [],
};
