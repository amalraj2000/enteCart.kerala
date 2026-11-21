import Link from "next/link";

const PATHS = {
  edit: <><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></>,
  delete: <><path d="M3 6h18" /><path d="M8 6V4h8v2" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6M14 11v6" /></>,
  view: <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></>,
};
const LOOK = {
  edit: "border-brand-600 text-brand-700 hover:bg-brand-50",
  view: "border-gray-300 text-gray-700 hover:bg-gray-50",
  delete: "border-red-300 text-red-600 hover:bg-red-50",
};

/** Icon-only Edit / View / Delete button for admin lists (a link when `href` is given). `label` is the tooltip and the screen-reader name. */
export default function IconBtn({ kind, label, href, onClick, disabled }: { kind: keyof typeof PATHS; label: string; href?: string; onClick?: () => void; disabled?: boolean }) {
  const cls = `inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border bg-white transition disabled:cursor-not-allowed disabled:opacity-50 ${LOOK[kind]}`;
  const icon = <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>{PATHS[kind]}</svg>;
  return href
    ? <Link href={href} className={cls} title={label} aria-label={label}>{icon}</Link>
    : <button type="button" className={cls} title={label} aria-label={label} onClick={onClick} disabled={disabled}>{icon}</button>;
}
