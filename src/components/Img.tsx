/* eslint-disable @next/next/no-img-element */
// Plain <img> so admins can paste ANY image URL (Meesho, etc.) without configuring next/image domains.
export default function Img({ src, alt, className }: { src: string; alt: string; className?: string }) {
  return src ? (
    <img src={src} alt={alt} className={className} referrerPolicy="no-referrer" loading="lazy" decoding="async" />
  ) : (
    <div className={`flex items-center justify-center bg-gray-100 text-4xl ${className}`}>🛍️</div>
  );
}
