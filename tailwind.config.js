/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        base: '#F3F5F2', // Fondo base solicitado
        brand: {
          orange: '#FA963D', // Naranja del logo
          green: '#30E674',  // Verde del logo
          blue: '#108BF7',   // Azul secundario
        }
      }
    },
  },
  plugins: [],
}
