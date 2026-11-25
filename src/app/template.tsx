/** Re-created on every navigation, so each page change gets a short fade-in (see .ek-page in globals.css). */
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="ek-page">{children}</div>;
}
