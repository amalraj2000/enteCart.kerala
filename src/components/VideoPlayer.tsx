"use client";
import { useRef, useState } from "react";
import type { VideoSrc } from "@/lib/video";

/**
 * Shorts-style player: no YouTube/Vimeo channel name, title, likes or comments around it. Autoplays muted, loops, tap to pause/play,
 * speaker button for sound. YouTube's own player is drawn slightly oversized inside a clipped box, so its title strip is cut off.
 */
export default function VideoPlayer({ video, title }: { video: VideoSrc; title: string }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const file = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(true);
  const [muted, setMuted] = useState(true);

  // YouTube and Vimeo each take their own postMessage commands.
  const yt = (func: string) => {
    const vimeo: Record<string, object> = { pauseVideo: { method: "pause" }, playVideo: { method: "play" }, mute: { method: "setVolume", value: 0 }, unMute: { method: "setVolume", value: 1 } };
    frame.current?.contentWindow?.postMessage(JSON.stringify(video.kind === "vimeo" ? vimeo[func] : { event: "command", func, args: [] }), "*");
  };
  const toggle = () => {
    if (video.kind === "file") { const v = file.current; if (v) v.paused ? v.play() : v.pause(); }
    else yt(playing ? "pauseVideo" : "playVideo");
    setPlaying(!playing);
  };
  const sound = () => {
    if (video.kind === "file") { if (file.current) file.current.muted = !muted; } else yt(muted ? "unMute" : "mute");
    setMuted(!muted);
  };

  return (
    <div className="relative h-full w-full overflow-hidden bg-black">
      {video.kind === "file" ? (
        <video ref={file} key={video.embed} src={video.embed} autoPlay muted loop playsInline preload="metadata" className="h-full w-full object-contain" />
      ) : (
        <iframe ref={frame} src={video.embed} title={`${title} video`} allow="autoplay; encrypted-media; picture-in-picture" referrerPolicy="strict-origin-when-cross-origin"
          className="pointer-events-none absolute inset-0 h-full w-full origin-center scale-[1.22] border-0" />
      )}
      <button type="button" aria-label={playing ? "Pause video" : "Play video"} onClick={toggle} className="absolute inset-0 z-10 flex items-center justify-center">
        {!playing && <span className="flex h-14 w-14 items-center justify-center rounded-full bg-black/55 text-2xl text-white">▶</span>}
      </button>
      <button type="button" aria-label={muted ? "Unmute" : "Mute"} onClick={sound} className="absolute bottom-3 right-3 z-20 flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-base text-white">{muted ? "🔇" : "🔊"}</button>
    </div>
  );
}
