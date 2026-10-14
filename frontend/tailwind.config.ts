import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: { 950: "#0c0f0d", 900: "#121614", 800: "#1a201d", 700: "#252d29", 500: "#5b675f" },
        mist: { 100: "#e8eee9", 300: "#a7b3ab" },
        lime: { 400: "#4ade80", 500: "#22c55e", 600: "#16a34a" },
      },
      fontFamily: {
        sans: ['"Segoe UI"', "system-ui", "-apple-system", "Roboto", "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;
