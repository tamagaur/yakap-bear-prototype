import { ClinicShell } from "@/components/clinic/clinic-shell";

export default function ClinicDashLayout({ children }: { children: React.ReactNode }) {
  return <ClinicShell>{children}</ClinicShell>;
}
