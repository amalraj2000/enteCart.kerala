/** Widths our image endpoint will produce. A fixed list keeps the number of cached variants small (and stops anyone asking for 1000 odd sizes). */
export const IMG_WIDTHS = [160, 320, 640, 1000] as const;

/**
 * Photos are cached by browsers and the CDN for a year (their ids never change). Bump this number if image ids are ever reused —
 * e.g. after the database was wiped and numbering restarted at 1 — so nobody keeps seeing the old picture that used the same id.
 */
export const IMG_VERSION = "2";

/**
 * Turns a stored image path into a responsive { src, srcSet }:
 *  • our own uploads (/api/images/12) → resized WebP copies made on demand and cached for a year,
 *  • Unsplash links → Unsplash's own resizer (w=, auto=format),
 *  • any other pasted URL (Meesho etc.) → unchanged, we can't resize someone else's server.
 */
export function responsiveSrc(src: string): { src: string; srcSet?: string } {
  if (/^\/api\/images\/\d+$/.test(src))
    return { src: `${src}?v=${IMG_VERSION}&w=640`, srcSet: IMG_WIDTHS.map((w) => `${src}?v=${IMG_VERSION}&w=${w} ${w}w`).join(", ") };
  try {
    const u = new URL(src);
    if (u.hostname === "images.unsplash.com") {
      const at = (w: number) => { const x = new URL(u); x.searchParams.set("w", String(w)); x.searchParams.set("auto", "format"); x.searchParams.set("q", "75"); return x.toString(); };
      return { src: at(640), srcSet: IMG_WIDTHS.map((w) => `${at(w)} ${w}w`).join(", ") };
    }
  } catch { /* relative or malformed → leave as is */ }
  return { src };
}

/** One big version of the picture (zoom, previews). */
export const largeSrc = (src: string) => (/^\/api\/images\/\d+$/.test(src) ? `${src}?v=${IMG_VERSION}&w=1000` : responsiveSrc(src).src);
