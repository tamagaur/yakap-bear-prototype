/**
 * Re-mounts on every navigation between top-level routes, so each page settles
 * in with a short fade and rise. With reduced motion it appears instantly.
 */
export default function RootTemplate({ children }: { children: React.ReactNode }) {
  return <div className="animate-page-in">{children}</div>;
}
