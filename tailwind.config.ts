import type { Config } from "tailwindcss";
export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      keyframes: {
        "toast-up": { from: { opacity: "0", transform: "translateX(40px) scale(.95)" }, to: { opacity: "1", transform: "none" } },
        "item-drop": { "0%": { opacity: "0", transform: "translateY(-6px) scale(.8)" }, "30%": { opacity: "1" }, "80%": { opacity: "1", transform: "translateY(26px) scale(1)" }, "100%": { opacity: "0", transform: "translateY(32px) scale(.7)" } },
        "cart-bob": { from: { transform: "translateX(-4px) rotate(-3deg)" }, to: { transform: "translateX(6px) rotate(3deg)" } },
        "toast-bar": { from: { transform: "scaleX(1)" }, to: { transform: "scaleX(0)" } },
      },
      colors: {
        // The shop colour is chosen by the owner (Admin → Settings → Theme colour). Layout injects the --brand-* variables; defaults live in globals.css.
        brand: Object.fromEntries([50, 100, 200, 500, 600, 700, 800].map((n) => [n, `rgb(var(--brand-${n}) / <alpha-value>)`])),
      },
    },
  },
  plugins: [],
} satisfies Config;
