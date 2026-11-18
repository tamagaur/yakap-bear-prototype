import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import type { Session } from '@/types/models';

export class BackendNotConfiguredError extends Error {
  constructor() {
    super('Account sign-in is not set up in this build. You can use the offline demo instead.');
    this.name = 'BackendNotConfiguredError';
  }
}

function requireClient() {
  if (!supabase) throw new BackendNotConfiguredError();
  return supabase;
}

function toSession(user: { id: string; email?: string; user_metadata?: Record<string, unknown> }): Session {
  return {
    kind: 'cloud',
    userId: user.id,
    email: user.email,
    displayName: typeof user.user_metadata?.display_name === 'string' ? user.user_metadata.display_name : undefined,
    startedAt: new Date().toISOString(),
  };
}

function friendlyAuthError(error: { message?: string; status?: number }): Error {
  const message = error.message?.toLowerCase() ?? '';
  if (message.includes('invalid login')) return new Error('That email and password do not match.');
  if (message.includes('already registered')) return new Error('An account with this email already exists.');
  if (message.includes('email not confirmed')) return new Error('Please confirm your email first, then sign in.');
  if (message.includes('network') || message.includes('fetch')) {
    return new Error('We could not reach the server. Please check your internet connection.');
  }
  return new Error('Something went wrong. Please try again in a moment.');
}

export const authService = {
  isConfigured: isSupabaseConfigured,

  async restore(): Promise<Session | null> {
    if (!supabase) return null;
    const { data } = await supabase.auth.getSession();
    return data.session?.user ? toSession(data.session.user) : null;
  },

  async signIn(email: string, password: string): Promise<Session> {
    const { data, error } = await requireClient().auth.signInWithPassword({ email: email.trim(), password });
    if (error || !data.user) throw friendlyAuthError(error ?? {});
    return toSession(data.user);
  },

  async signUp(
    name: string,
    email: string,
    password: string,
  ): Promise<{ session: Session | null; needsEmailConfirmation: boolean }> {
    const { data, error } = await requireClient().auth.signUp({
      email: email.trim(),
      password,
      options: { data: { display_name: name.trim() } },
    });
    if (error) throw friendlyAuthError(error);
    if (data.session?.user) return { session: toSession(data.session.user), needsEmailConfirmation: false };
    return { session: null, needsEmailConfirmation: true };
  },

  async sendPasswordReset(email: string): Promise<void> {
    const { error } = await requireClient().auth.resetPasswordForEmail(email.trim());
    if (error) throw friendlyAuthError(error);
  },

  async signOut(): Promise<void> {
    if (supabase) await supabase.auth.signOut();
  },
};
