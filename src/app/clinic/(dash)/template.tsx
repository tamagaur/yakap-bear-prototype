/** Page change inside the clinic: the sidebar stays put, the content settles in. */
export default function ClinicTemplate({ children }: { children: React.ReactNode }) {
  return <div className="animate-page-in">{children}</div>;
}
