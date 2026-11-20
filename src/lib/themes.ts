/**
 * Shop colour themes the owner can pick in Admin → Settings. Pure data (safe to import in the browser).
 * Only ids from this list are ever accepted or written into the page, so no one can inject CSS through the setting.
 * Shade 600 is the main button colour: every theme keeps it dark enough for white text (WCAG AA).
 */
export const SHADES = [50, 100, 200, 500, 600, 700, 800] as const;
export type Shade = (typeof SHADES)[number];
export type Theme = { id: string; name: string; shades: Record<Shade, string> };

const t = (id: string, name: string, v: [string, string, string, string, string, string, string]): Theme => ({ id, name, shades: Object.fromEntries(SHADES.map((s, i) => [s, v[i]])) as Record<Shade, string> });

export const THEMES: Theme[] = [
  t("violet", "Violet", ["#f5f3ff", "#ede9fe", "#ddd6fe", "#8b5cf6", "#7c3aed", "#6d28d9", "#5b21b6"]),
  t("indigo", "Indigo", ["#eef2ff", "#e0e7ff", "#c7d2fe", "#6366f1", "#4f46e5", "#4338ca", "#3730a3"]),
  t("blue", "Ocean blue", ["#eff6ff", "#dbeafe", "#bfdbfe", "#3b82f6", "#2563eb", "#1d4ed8", "#1e40af"]),
  t("teal", "Teal", ["#f0fdfa", "#ccfbf1", "#99f6e4", "#14b8a6", "#0f766e", "#115e59", "#134e4a"]),
  t("green", "Kerala green", ["#f0fdf4", "#dcfce7", "#bbf7d0", "#22a35a", "#15803d", "#126f3b", "#0f5a31"]),
  t("orange", "Saffron orange", ["#fff7ed", "#ffedd5", "#fed7aa", "#f97316", "#c2410c", "#9a3412", "#7c2d12"]),
  t("red", "Festive red", ["#fef2f2", "#fee2e2", "#fecaca", "#ef4444", "#dc2626", "#b91c1c", "#991b1b"]),
  t("rose", "Rose", ["#fff1f2", "#ffe4e6", "#fecdd3", "#f43f5e", "#e11d48", "#be123c", "#9f1239"]),
  t("magenta", "Magenta", ["#fdf4ff", "#fae8ff", "#f5d0fe", "#d946ef", "#a21caf", "#86198f", "#701a75"]),
  t("sky", "Sky blue", ["#f0f9ff", "#e0f2fe", "#bae6fd", "#0ea5e9", "#0369a1", "#075985", "#0c4a6e"]),
  t("cyan", "Cyan", ["#ecfeff", "#cffafe", "#a5f3fc", "#06b6d4", "#0e7490", "#155e75", "#164e63"]),
  t("emerald", "Emerald", ["#ecfdf5", "#d1fae5", "#a7f3d0", "#10b981", "#047857", "#065f46", "#064e3b"]),
  t("olive", "Olive", ["#f7fee7", "#ecfccb", "#d9f99d", "#84cc16", "#4d7c0f", "#3f6212", "#365314"]),
  t("gold", "Gold", ["#fffbeb", "#fef3c7", "#fde68a", "#f59e0b", "#b45309", "#92400e", "#78350f"]),
  t("pink", "Pink", ["#fdf2f8", "#fce7f3", "#fbcfe8", "#ec4899", "#db2777", "#be185d", "#9d174d"]),
  t("plum", "Plum", ["#faf5ff", "#f3e8ff", "#e9d5ff", "#a855f7", "#7e22ce", "#6b21a8", "#581c87"]),
  t("maroon", "Maroon", ["#fdf2f4", "#fce7eb", "#f9cfd8", "#c2415c", "#9f1239", "#881337", "#6c0f2d"]),
  t("navy", "Navy", ["#f0f5ff", "#e0eaff", "#c2d4ff", "#3b5bdb", "#1e40af", "#1e3a8a", "#172554"]),
  t("coffee", "Coffee brown", ["#fdf8f6", "#f2e8e5", "#eaddd7", "#a18072", "#7c4a35", "#633a29", "#4a2c20"]),
  t("charcoal", "Charcoal", ["#f8fafc", "#f1f5f9", "#e2e8f0", "#64748b", "#334155", "#1e293b", "#0f172a"]),
];
export const DEFAULT_THEME = "violet";
export const THEME_IDS = THEMES.map((x) => x.id);
export const themeById = (id: unknown): Theme => THEMES.find((x) => x.id === id) ?? THEMES[0];

/** "#7c3aed" → "124 58 237" (the form Tailwind needs for colours that support opacity, e.g. bg-brand-600/50). */
const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(" ");

/** CSS variables for a theme, as a style object / CSS text. Values come only from the fixed list above. */
export const themeVars = (theme: Theme): Record<string, string> => Object.fromEntries(SHADES.map((s) => [`--brand-${s}`, rgb(theme.shades[s])]));
// "html:root" outranks the plain ":root" defaults in globals.css, whichever stylesheet loads last.
export const themeCss = (theme: Theme) => `html:root{${Object.entries(themeVars(theme)).map(([k, v]) => `${k}:${v}`).join(";")}}`;
