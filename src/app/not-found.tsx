import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Page not found", robots: { index: false } };

/** Animated penguin 404 (English + Malayalam): the penguin is the "0". Pure SVG + CSS (no JS, no images); animations stop for people who prefer reduced motion. */
export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center px-4 py-10 text-center sm:py-16">
      <style>{`
        @keyframes nf-bob { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-8px) } }
        @keyframes nf-wave { 0%,100% { transform: rotate(0deg) } 50% { transform: rotate(-38deg) } }
        @keyframes nf-blink { 0%,92%,100% { transform: scaleY(1) } 96% { transform: scaleY(.1) } }
        @keyframes nf-shadow { 0%,100% { transform: scaleX(1); opacity: .25 } 50% { transform: scaleX(.8); opacity: .15 } }
        @keyframes nf-pop { 0% { opacity: 0; transform: translateY(8px) scale(.85) } 100% { opacity: 1; transform: none } }
        @keyframes nf-snow { 0% { transform: translateY(-10px); opacity: 0 } 15% { opacity: .9 } 100% { transform: translateY(190px); opacity: 0 } }
        .nf-bob { animation: nf-bob 2.4s ease-in-out infinite }
        .nf-wave { animation: nf-wave 1.1s ease-in-out infinite; transform-box: fill-box; transform-origin: 15% 10% }
        .nf-blink { animation: nf-blink 4s infinite; transform-box: fill-box; transform-origin: center }
        .nf-shadow { animation: nf-shadow 2.4s ease-in-out infinite; transform-box: fill-box; transform-origin: center }
        .nf-pop { animation: nf-pop .6s .3s both cubic-bezier(.2,1.4,.4,1) }
        .nf-flake { animation: nf-snow 4s linear infinite }
        @media (prefers-reduced-motion: reduce) { .nf-bob, .nf-wave, .nf-blink, .nf-shadow, .nf-pop, .nf-flake { animation: none } }
      `}</style>

      <div className="nf-pop rounded-2xl rounded-bl-sm bg-brand-50 px-4 py-2 text-sm font-semibold text-brand-800 ring-1 ring-brand-200">
        <span className="block">Oops! This page slid away on the ice 🧊</span>
        <span lang="ml" className="mt-0.5 block">ക്ഷമിക്കണം! ഈ പേജ് ഐസിൽ തെന്നിപ്പോയി</span>
      </div>
      <div className="-mt-px ml-[-4.5rem] h-3 w-3 rotate-45 bg-brand-50 ring-1 ring-brand-200 [clip-path:polygon(0_100%,100%_100%,0_0)]" aria-hidden />

      <div className="mt-1 flex items-end justify-center gap-1 sm:gap-3" role="img" aria-label="404">
        <span className="select-none text-[7rem] font-black leading-none text-brand-600 sm:text-[10rem]" aria-hidden>4</span>

        {/* the penguin is the "0" */}
        <svg viewBox="0 0 120 170" className="h-32 w-24 shrink-0 overflow-visible sm:h-48 sm:w-36" aria-hidden>
          <ellipse className="nf-shadow" cx="60" cy="160" rx="34" ry="6" fill="#000" />
          {[18, 52, 88, 104].map((x, i) => (
            <circle key={x} className="nf-flake" cx={x} cy="0" r={i % 2 ? 2 : 3} fill="#bfdbfe" style={{ animationDelay: `${i * 0.9}s` }} />
          ))}
          <g className="nf-bob">
            {/* feet */}
            <ellipse cx="44" cy="146" rx="13" ry="6" fill="#f59e0b" />
            <ellipse cx="76" cy="146" rx="13" ry="6" fill="#f59e0b" />
            {/* body + belly */}
            <ellipse cx="60" cy="88" rx="40" ry="56" fill="#1f2937" />
            <ellipse cx="60" cy="100" rx="27" ry="40" fill="#f9fafb" />
            {/* flippers: left hangs, right waves */}
            <ellipse cx="19" cy="98" rx="8" ry="24" fill="#111827" transform="rotate(12 19 98)" />
            <g className="nf-wave">
              <ellipse cx="101" cy="98" rx="8" ry="24" fill="#111827" transform="rotate(-12 101 98)" />
            </g>
            {/* eyes */}
            <g className="nf-blink">
              <circle cx="47" cy="66" r="9" fill="#fff" />
              <circle cx="73" cy="66" r="9" fill="#fff" />
              <circle cx="49" cy="67" r="4.5" fill="#111827" />
              <circle cx="75" cy="67" r="4.5" fill="#111827" />
              <circle cx="50.5" cy="65" r="1.5" fill="#fff" />
              <circle cx="76.5" cy="65" r="1.5" fill="#fff" />
            </g>
            {/* cheeks + beak */}
            <circle cx="36" cy="79" r="5" fill="#fda4af" opacity=".8" />
            <circle cx="84" cy="79" r="5" fill="#fda4af" opacity=".8" />
            <path d="M51 78 Q60 74 69 78 Q66 90 60 91 Q54 90 51 78Z" fill="#f59e0b" />
            {/* brand-green scarf */}
            <path d="M24 104 Q60 120 96 104 L96 117 Q60 133 24 117Z" fill="#178a49" />
            <path d="M80 118 L90 146 L77 146 L72 122Z" fill="#126f3b" />
          </g>
        </svg>

        <span className="select-none text-[7rem] font-black leading-none text-brand-600 sm:text-[10rem]" aria-hidden>4</span>
      </div>

      <h1 className="mt-6 text-2xl font-bold text-gray-900 sm:text-3xl">Page not found</h1>
      <p className="mt-2 max-w-sm text-gray-600">The page you are looking for doesn&apos;t exist or has moved. Let&apos;s get you back to the shop.</p>

      {/* Malayalam version, shown right below the English one */}
      <h2 lang="ml" className="mt-5 text-xl font-bold text-gray-900 sm:text-2xl">പേജ് കണ്ടെത്താനായില്ല</h2>
      <p lang="ml" className="mt-2 max-w-sm leading-relaxed text-gray-600">നിങ്ങൾ തിരയുന്ന പേജ് നിലവിലില്ല, അല്ലെങ്കിൽ മാറ്റിയിരിക്കുന്നു. നമുക്ക് ഷോപ്പിലേക്ക് തിരികെ പോകാം.</p>

      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Link href="/" className="btn-primary flex-col leading-tight">Back to shop<span lang="ml" className="text-xs font-normal opacity-90">ഷോപ്പിലേക്ക് മടങ്ങുക</span></Link>
        <Link href="/wishlist" className="btn-outline flex-col leading-tight">My wishlist<span lang="ml" className="text-xs font-normal opacity-90">എന്റെ ഇഷ്ടപ്പട്ടിക</span></Link>
      </div>
    </div>
  );
}
