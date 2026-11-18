import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

import { supabase } from '@/lib/supabase';
import { LocalCareRepository } from '@/repositories/LocalCareRepository';
import { OfflineFirstRepository } from '@/repositories/OfflineFirstRepository';
import { SupabaseCareRepository } from '@/repositories/SupabaseCareRepository';
import type { CareRepository } from '@/repositories/types';
import { authService } from '@/services/auth/authService';
import { useCareStore } from '@/stores/careStore';
import type { Session } from '@/types/models';

const DEMO_SESSION_KEY = 'yakap.session.demo.v1';
const DEMO_NAMESPACE = 'demo';

type SessionStatus = 'loading' | 'signedOut' | 'signedIn';

interface SessionState {
  status: SessionStatus;
  session: Session | null;
  syncWarning: string | null;
  bootstrap: () => Promise<void>;
  enterDemo: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (name: string, email: string, password: string) => Promise<{ needsEmailConfirmation: boolean }>;
  signOut: () => Promise<void>;
}

export const useSessionStore = create<SessionState>((set, get) => {
  const repositoryFor = (session: Session): CareRepository => {
    if (session.kind === 'demo' || !supabase) return new LocalCareRepository(DEMO_NAMESPACE);
    return new OfflineFirstRepository(
      new LocalCareRepository(`user.${session.userId}`),
      new SupabaseCareRepository(supabase, session.userId),
      () => set({ syncWarning: 'Changes are saved on this phone and will sync when the connection returns.' }),
    );
  };

  const activate = async (session: Session) => {
    await useCareStore.getState().hydrate(repositoryFor(session));
    set({ session, status: 'signedIn' });
  };

  return {
    status: 'loading',
    session: null,
    syncWarning: null,

    bootstrap: async () => {
      if (get().status !== 'loading') return;
      try {
        const cloudSession = await authService.restore().catch(() => null);
        if (cloudSession) return await activate(cloudSession);
        const raw = await AsyncStorage.getItem(DEMO_SESSION_KEY);
        if (raw) return await activate(JSON.parse(raw) as Session);
      } catch {
        await AsyncStorage.removeItem(DEMO_SESSION_KEY).catch(() => undefined);
      }
      set({ status: 'signedOut' });
    },

    enterDemo: async () => {
      const session: Session = { kind: 'demo', userId: 'demo', startedAt: new Date().toISOString() };
      await AsyncStorage.setItem(DEMO_SESSION_KEY, JSON.stringify(session));
      await activate(session);
    },

    signIn: async (email, password) => {
      await activate(await authService.signIn(email, password));
    },

    signUp: async (name, email, password) => {
      const { session, needsEmailConfirmation } = await authService.signUp(name, email, password);
      if (session) await activate({ ...session, displayName: name.trim() });
      return { needsEmailConfirmation };
    },

    /** Demo data stays on the phone after signing out and returns when demo mode is reopened. */
    signOut: async () => {
      await useCareStore.getState().flush();
      await AsyncStorage.removeItem(DEMO_SESSION_KEY);
      await authService.signOut().catch(() => undefined);
      set({ session: null, status: 'signedOut', syncWarning: null });
    },
  };
});
