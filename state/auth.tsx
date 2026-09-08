/**
 * The AgroExact account: signing in, staying signed in, and saying when it broke.
 *
 * One account at a time — the app is a weather app with an integration, not a
 * multi-tenant dashboard — but the shape here is per-integration rather than global,
 * so a second provider later means a second entry rather than a rewrite.
 *
 * Tokens live in expo-secure-store, never in `Prefs`: preferences are readable
 * application state that gets written to AsyncStorage in the clear, and a bearer
 * token is a credential. Which account is connected *is* in preferences, because the
 * settings screen has to be able to say so before any network call.
 *
 * ## Why the status has four values
 *
 * `disconnected` and `connected` are obvious. `expired` is the one that earns its
 * keep: a refresh token that WorkOS rejects means the integration is dead, but the
 * locations it created are still perfectly good places, so the app keeps them, drops
 * back to Open-Meteo for their measurements, and puts a warning in Instellingen
 * rather than deleting anything. `connecting` exists so the button can be disabled
 * while the browser sheet is up.
 */
import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
  type ReactNode,
} from 'react';
import * as SecureStore from 'expo-secure-store';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import {
  AUTHKIT_ENDPOINTS, AuthRevokedError, OAUTH_SCOPES, WORKOS_CLIENT_ID,
  exchangeCode, fetchAccount, isExpired, refreshTokens,
  type AuthAccount, type AuthTokens,
} from '../core/auth/workos';

/** Completes the browser session on return, as expo-auth-session requires. */
WebBrowser.maybeCompleteAuthSession();

const TOKENS_KEY = 'exactcast.agro.oauth.v1';

/** Must be registered as a redirect URI on the AuthKit application, verbatim. */
export const REDIRECT_URI = AuthSession.makeRedirectUri({
  scheme: 'exactcast',
  path: 'oauth/agroexact',
});

export type AuthStatus = 'disconnected' | 'connecting' | 'connected' | 'expired';

export interface AuthState {
  status: AuthStatus;
  /** Who is signed in, when AuthKit told us. Null on an anonymous-looking token. */
  account: AuthAccount | null;
  /** Set when the last sign-in attempt failed, for the settings row. */
  error: string | null;
  /** True until stored tokens have been read, so the UI does not flash "niet verbonden". */
  ready: boolean;
  /** Resolves with the account that was connected, or null if nothing was. The
   *  account is returned rather than only stored because the caller writes it into
   *  preferences in the same tick, when React has not re-rendered with it yet. */
  signIn: () => Promise<AuthAccount | null>;
  signOut: () => Promise<void>;
  /**
   * A usable access token, refreshing first when the current one is spent.
   *
   * Returns null rather than throwing when there is nothing to work with: every
   * caller is a data source that has an Open-Meteo path to fall back to, and a
   * throw would turn "no integration" into an error screen.
   *
   * Pass `spentToken` — the token a call was just refused with — to refresh one the
   * clock still believes in. WorkOS can retire an access token ahead of the expiry it
   * advertised, and the device clock is not WorkOS's clock, so "the API said no" is
   * better evidence than any local sum. The refresh then runs only while that token
   * is still the one in hand: two sources refused in the same tick share one refresh
   * instead of rotating the refresh token twice.
   */
  getAccessToken: (spentToken?: string) => Promise<string | null>;
}

const AuthContext = createContext<AuthState | null>(null);

interface StoredAuth {
  tokens: AuthTokens;
  account: AuthAccount | null;
}

async function readStored(): Promise<StoredAuth | null> {
  try {
    const raw = await SecureStore.getItemAsync(TOKENS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredAuth;
    if (!parsed?.tokens?.accessToken) return null;
    return parsed;
  } catch {
    // An unreadable keychain entry is indistinguishable from none, and treating it
    // as none only costs a sign-in.
    return null;
  }
}

async function writeStored(value: StoredAuth | null): Promise<void> {
  try {
    if (value) await SecureStore.setItemAsync(TOKENS_KEY, JSON.stringify(value));
    else await SecureStore.deleteItemAsync(TOKENS_KEY);
  } catch {
    // Failing to persist costs the next launch a sign-in, not this session.
  }
}

export function AgroAuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('disconnected');
  const [account, setAccount] = useState<AuthAccount | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  /** The live tokens. A ref, not state: `getAccessToken` is called from effects and
   *  must see the token the last refresh produced, not the one its closure captured. */
  const tokensRef = useRef<AuthTokens | null>(null);
  /** One refresh at a time. Several sources ask for a token in the same tick, and
   *  parallel refreshes would race to rotate the same refresh token — the loser's
   *  copy is then invalid, which reads exactly like a revoked grant. */
  const refreshing = useRef<Promise<string | null> | null>(null);

  useEffect(() => {
    let alive = true;
    readStored().then((stored) => {
      if (!alive) return;
      if (stored) {
        tokensRef.current = stored.tokens;
        setAccount(stored.account);
        // Expiry alone is not a problem — the refresh token fixes it on first use.
        setStatus(stored.tokens.refreshToken || !isExpired(stored.tokens) ? 'connected' : 'expired');
      }
      setReady(true);
    });
    return () => { alive = false; };
  }, []);

  const disconnect = useCallback(async (next: AuthStatus) => {
    tokensRef.current = null;
    await writeStored(null);
    setAccount(null);
    setStatus(next);
  }, []);

  const signIn = useCallback(async (): Promise<AuthAccount | null> => {
    setError(null);
    setStatus('connecting');
    try {
      // PKCE, generated per attempt. `expo-auth-session` owns the verifier and the
      // browser sheet; everything after the redirect is plain HTTP in core/auth.
      const request = new AuthSession.AuthRequest({
        clientId: WORKOS_CLIENT_ID,
        redirectUri: REDIRECT_URI,
        scopes: OAUTH_SCOPES,
        responseType: AuthSession.ResponseType.Code,
        usePKCE: true,
      });

      const result = await request.promptAsync(AUTHKIT_ENDPOINTS);

      if (result.type !== 'success' || !result.params.code) {
        // Dismissing the sheet is a decision, not a failure, so it gets no error row.
        setStatus(tokensRef.current ? 'connected' : 'disconnected');
        if (result.type === 'error') {
          setError(result.params?.error_description ?? result.error?.description ?? 'Inloggen mislukt');
        }
        return null;
      }

      const tokens = await exchangeCode({
        code: result.params.code,
        codeVerifier: request.codeVerifier ?? '',
        redirectUri: REDIRECT_URI,
      });
      const who = await fetchAccount(tokens.accessToken);

      tokensRef.current = tokens;
      await writeStored({ tokens, account: who });
      setAccount(who);
      setStatus('connected');
      return who;
    } catch (e) {
      setStatus('disconnected');
      setError((e as Error)?.message ?? 'Inloggen mislukt');
      return null;
    }
  }, []);

  const signOut = useCallback(async () => {
    await disconnect('disconnected');
    setError(null);
  }, [disconnect]);

  const getAccessToken = useCallback(async (spentToken?: string): Promise<string | null> => {
    const current = tokensRef.current;
    if (!current) return null;
    // A caller that names the token it was refused with is asking for that token to
    // be replaced. Where it already has been, hand over the replacement and refresh
    // nothing: the caller is simply behind, not holding a dead credential.
    if (spentToken != null && spentToken !== current.accessToken) return current.accessToken;
    if (spentToken == null && !isExpired(current)) return current.accessToken;
    if (!current.refreshToken) {
      await disconnect('expired');
      return null;
    }
    if (refreshing.current) return refreshing.current;

    const run = (async () => {
      try {
        const next = await refreshTokens(current.refreshToken as string);
        tokensRef.current = next;
        await writeStored({ tokens: next, account });
        setStatus('connected');
        return next.accessToken;
      } catch (e) {
        if (e instanceof AuthRevokedError) {
          // The grant is gone: the integration is disconnected until someone signs
          // in again. Locations it created are left alone by design.
          await disconnect('expired');
          return null;
        }
        // A network failure says nothing about the token, so it stays.
        return null;
      } finally {
        refreshing.current = null;
      }
    })();

    refreshing.current = run;
    return run;
  }, [account, disconnect]);

  const value = useMemo<AuthState>(
    () => ({ status, account, error, ready, signIn, signOut, getAccessToken }),
    [status, account, error, ready, signIn, signOut, getAccessToken]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAgroAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAgroAuth must be used inside an AgroAuthProvider');
  return ctx;
}
