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
        title="Accounts coming soon"
        message="Use the demo to try everything."
      />
    );
  }
  if (!online) {
    return (
      <Notice
        icon="wifi-off"
        tone="coral"
        title="You're offline"
        message="Reconnect to sign in. The demo still works."
      />
    );
  }
  return null;
}
