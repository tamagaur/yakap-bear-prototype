import { Notice } from '@/components/ui/Bits';
import { useIsOnline } from '@/hooks/useServices';
import { authService } from '@/services/auth/authService';

/** Explains plainly when real accounts are unavailable in this build or on this connection. */
export function BackendNotice() {
  const online = useIsOnline();
  if (!authService.isConfigured) {
    return (
      <Notice
        icon="cloud-off"
        tone="honey"
        title="Accounts are not connected yet"
        message="This build has no account server. Use the offline demo to try every feature on this phone."
      />
    );
  }
  if (!online) {
    return (
      <Notice
        icon="wifi-off"
        tone="coral"
        title="No internet connection"
        message="Connect to the internet to use your account. The offline demo still works."
      />
    );
  }
  return null;
}
