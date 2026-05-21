import { SupabaseClient, AuthError, User, Session } from '@supabase/supabase-js';
import { SimUser, SimConfig } from '../types';
import { createAnonClient } from '../supabase';

/**
 * Per-user session manager. Each user gets its own Supabase client and auth session.
 */
export class UserSession {
  readonly user: SimUser;
  readonly client: SupabaseClient;
  private config: SimConfig;

  constructor(user: SimUser, config: SimConfig) {
    this.user = user;
    this.config = config;
    this.client = createAnonClient(config);
  }
  /**
   * Authenticate a user with deterministic credentials so they can be reused across runs.
   *
   * Flow:
   *  1) Try sign-in with deterministic password
   *  2) If sign-in fails with invalid credentials, try sign-up
   *  3) If sign-up reports "already registered", retry sign-in once
   *  4) Apply small backoff/jitter on 429 rate-limit responses
   */
  async authenticate(): Promise<void> {
    const email = this.user.email;
    const password = this.user.password;

    // Helper: small backoff with jitter for rate-limit (429) responses
    const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    const isRateLimitError = (error: AuthError | null) => {
      if (!error) return false;
      if (error.status === 429 || error.code === '429') return true;
      return (error.message ?? '').match(/rate limit/i) != null;
    };

    type AuthResult<T> = { data: T; error: AuthError | null };

    // Wrapper to call an auth function with a single retry on 429
    const withRateLimitBackoff = async <T>(
      fn: () => Promise<AuthResult<T>>
    ): Promise<AuthResult<T>> => {
      let { data, error } = await fn();
      if (isRateLimitError(error)) {
        const jitter = 100 + Math.floor(Math.random() * 200); // 100–300ms
        await sleep(jitter);
        ({ data, error } = await fn());
      }
      return { data, error };
    };

    // 1) Try sign-in first with deterministic password
    const { data: initialSignInData, error: initialSignInError } =
      await withRateLimitBackoff<any>(() =>
        this.client.auth.signInWithPassword({
          email,
          password,
        }) as any
      );

    if (!initialSignInError) {
      // Successful sign-in
      this.user.id = initialSignInData.user?.id ?? this.user.id;
      this.user.sessionToken = initialSignInData.session?.access_token;
      this.user.refreshToken = initialSignInData.session?.refresh_token;
      return;
    }

    // If invalid credentials, attempt sign-up with same deterministic password
    const invalidCreds =
      (initialSignInError.message ?? '').toLowerCase().includes('invalid login credentials') ||
      initialSignInError.code === '400';

    if (invalidCreds) {
      const { data: signUpData, error: signUpError } = await withRateLimitBackoff<any>(() =>
        this.client.auth.signUp({ email, password }) as any
      );

      if (signUpError) {
        const alreadyRegistered =
          (signUpError.message ?? '').includes('already registered') ||
          (signUpError.message ?? '').includes('already been registered') ||
          signUpError.status === 400 ||
          signUpError.status === 422;

        if (alreadyRegistered) {
          // User exists but initial sign-in failed — retry sign-in once
          const { data: retrySignInData, error: retrySignInError } =
            await withRateLimitBackoff<any>(() =>
              this.client.auth.signInWithPassword({
                email,
                password,
              }) as any
            );

          if (retrySignInError) {
            throw new Error(
              `Auth failed for ${maskEmail(email)}: initial sign-in error: ${initialSignInError.message}, sign-up error: ${signUpError.message}, retry sign-in error: ${retrySignInError.message}`
            );
          }

          this.user.id = retrySignInData.user?.id ?? this.user.id;
          this.user.sessionToken = retrySignInData.session?.access_token;
          this.user.refreshToken = retrySignInData.session?.refresh_token;
          return;
        }

        // Non-duplicate sign-up failure
        throw new Error(`Sign-up failed for ${maskEmail(email)}: ${signUpError.message}`);
      }

      // New user created successfully
      if (signUpData.user) {
        this.user.id = signUpData.user.id;
      }
      if (signUpData.session) {
        this.user.sessionToken = signUpData.session.access_token;
        this.user.refreshToken = signUpData.session.refresh_token;
      }
      return;
    }

    // Non-credential sign-in error (e.g., RLS, config) — surface directly
    throw new Error(`Sign-in failed for ${maskEmail(email)}: ${initialSignInError.message}`);
  }

  /**
   * Refresh session if expired.
   */
  async ensureSession(): Promise<void> {
    const { data } = await this.client.auth.getSession();
    if (!data.session && this.user.refreshToken) {
      const { error } = await this.client.auth.refreshSession({
        refresh_token: this.user.refreshToken,
      });
      if (error) {
        // Re-authenticate from scratch
        await this.authenticate();
      }
    }
  }

  /**
   * Clean up: sign out.
   */
  async signOut(): Promise<void> {
    try {
      await this.client.auth.signOut();
    } catch {
      // Ignore sign-out errors during cleanup
    }
  }
}

function maskEmail(email: string): string {
  return 'sim-user-***@darknite-test.internal';
}
