// Generates iOS launch (splash) screens: white background + app icon, one per common iPhone/iPad size.  Run: node scripts/make-splash.mjs
import sharp from "sharp";
const SIZES = [[1290,2796,430,932,3],[1179,2556,393,852,3],[1284,2778,428,926,3],[1170,2532,390,844,3],[1125,2436,375,812,3],[1242,2688,414,896,3],[828,1792,414,896,2],[1242,2208,414,736,3],[750,1334,375,667,2],[1536,2048,768,1024,2],[1668,2388,834,1194,2],[2048,2732,1024,1366,2]];
for (const [w, h] of SIZES) {
  const icon = await sharp("public/icons/icon-512.png").resize(Math.round(w * 0.32)).toBuffer();
  await sharp({ create: { width: w, height: h, channels: 3, background: "#ffffff" } }).composite([{ input: icon, gravity: "centre" }]).png({ compressionLevel: 9, palette: true }).toFile(`public/splash/${w}x${h}.png`);
}
console.log(JSON.stringify(SIZES));
