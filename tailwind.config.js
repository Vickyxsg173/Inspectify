/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#FF2D55",
          50: "#FFF0F3",
          100: "#FFE2E7",
          200: "#FFC5D0",
          300: "#FF98AB",
          400: "#FF5E7E",
          500: "#FF2D55",
          600: "#E02047",
          700: "#C01439",
          800: "#9E0E2E",
          900: "#800A25",
        },
        surface: {
          light: "#FFFFFF",
          cardLight: "#FFFFFF",
          elevatedLight: "#F8F9FA",
          dark: "#000000",
          cardDark: "#111114",
          elevatedDark: "#18181C",
        },
        brand: {
          red: {
            DEFAULT: "#FF2D55",
            light: "#FF5E7E",
            dark: "#E02047",
          },
          beige: {
            DEFAULT: "#FFFFFF",
            dark: "#F4F4F6",
            100: "#FFFFFF",
            200: "#FFFFFF",
            300: "#F4F4F6",
          },
          green: {
            DEFAULT: "#FF2D55",
            light: "#FF5E7E",
            dark: "#E02047",
            accent: "#FF2D55",
          },
          forest: {
            black: "#000000",
            surface: "#111114",
            selected: "#1A1A1F",
          }
        }
      }
    },
  },
  plugins: [],
}
