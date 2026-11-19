/** Product video links: a YouTube / Vimeo page link, or a direct https link to an .mp4 / .webm file. Nothing is uploaded or stored — only the link. */
export type VideoSrc = { kind: "youtube" | "vimeo"; id: string; embed: string } | { kind: "file"; embed: string };

export function parseVideo(raw: string): VideoSrc | null {
  if (/^\/api\/videos\/\d{1,12}$/.test(raw.trim())) return { kind: "file", embed: raw.trim() }; // uploaded to this site
  let u: URL;
  try { u = new URL(raw.trim()); } catch { return null; }
  if (u.protocol !== "https:") return null;
  const host = u.hostname.replace(/^(www|m)\./, "");
  let id = "";
  if (host === "youtu.be") id = u.pathname.slice(1).split("/")[0];
  else if (host === "youtube.com" || host === "youtube-nocookie.com") {
    id = u.pathname === "/watch" ? u.searchParams.get("v") || "" : (u.pathname.match(/^\/(?:embed|shorts|live|v)\/([^/?]+)/) || [])[1] || "";
  }
  if (host === "youtu.be" || host === "youtube.com" || host === "youtube-nocookie.com")
    return /^[\w-]{11}$/.test(id) ? { kind: "youtube", id, embed: `https://www.youtube-nocookie.com/embed/${id}?rel=0` } : null;
  if (host === "vimeo.com" || host === "player.vimeo.com") {
    const m = u.pathname.match(/\/(\d{5,12})(?:\/|$)/);
    return m ? { kind: "vimeo", id: m[1], embed: `https://player.vimeo.com/video/${m[1]}` } : null;
  }
  if (/\.(mp4|webm|mov)$/i.test(u.pathname)) return { kind: "file", embed: u.href };
  return null;
}
