import type { Config } from "tailwindcss";
export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      keyframes: {
        "toast-up": { from: { opacity: "0", transform: "translateX(40px) scale(.95)" }, to: { opacity: "1", transform: "none" } },
        "toast-bar": { from: { transform: "scaleX(1)" }, to: { transform: "scaleX(0)" } },
      },
      colors: {
        brand: { 50: "#f0fdf4", 100: "#dcfce7", 200: "#bbf7d0", 500: "#22a35a", 600: "#178a49", 700: "#126f3b", 800: "#0f5a31" },
      },
    },
  },
  plugins: [],
} satisfies Config;
