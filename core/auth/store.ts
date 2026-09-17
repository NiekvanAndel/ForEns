/**
 * Where the AgroExact tokens live, and how to get a usable one outside React.
 *
 * `state/auth` owns the sign-in flow and the live session; this owns the keychain
 * entry itself. It was inside that provider, which was fine while the app was the
 * only thing that read it — and stopped being fine the moment the background task
 * needed a token too. Two copies of a keychain key and an accessibility option is a
 * bug waiting for the day one of them is edited.
 *
 * ## The background path is deliberately smaller than the app's
 *
 * `AgroAuthProvider` keeps status, an account, an error for the settings row, and a
 * single-flight refresh shared between the several sources that ask in one tick. A
 * background task has no UI to tell, no second caller, and about thirty seconds. So
 * `backgroundAccessToken` does the one thing that matters: hand back a token that
 * will work, refreshing first if the stored one is spent, and writing the rotated
 * pair back so the app does not find a refresh token that was already used.
 *
 * It returns null for every kind of failure. A background run with no token skips
 * the work that needed one; it must never sign anybody out, because a keychain that
 * cannot be read on a locked phone is indistinguishable from an account that was
 * disconnected, and only one of those is worth acting on.
 *
 * ## The keychain is imported lazily
 *
 * `expo-secure-store` is a native module, and `core/` is the half of this app the
 * test runner can load. A static import here would take every module that reaches
 * this one down with it — which is how it was found: adding the alert evaluation put
 * a keychain read on a path the tests walk.
 */
import { AuthRevokedError, isExpired, refreshTokens, type AuthAccount, type AuthTokens } from './workos';

export const TOKENS_KEY = 'exactcast.agro.oauth.v1';

/**
 * The keychain, and the accessibility the entry is written with.
 *
 * `AFTER_FIRST_UNLOCK` rather than the default `WHEN_UNLOCKED`, which is stricter
 * than this app can live with: the widget and the background refresh run on a phone
 * in a pocket, and a keychain read that fails there is indistinguishable from a
 * signed-out account — the integration would quietly drop out and reappear on unlock.
 * It still keeps the tokens unreadable on a device that has not been unlocked since
 * it powered on, which is the case that matters for a lost phone.
 */
async function keychain() {
  const SecureStore = await import('expo-secure-store');
  return {
    SecureStore,
    options: { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK },
  };
}

export interface StoredAuth {
  tokens: AuthTokens;
  account: AuthAccount | null;
}

export async function readStoredAuth(): Promise<StoredAuth | null> {
  try {
    const { SecureStore, options } = await keychain();
    const raw = await SecureStore.getItemAsync(TOKENS_KEY, options);
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

export async function writeStoredAuth(value: StoredAuth | null): Promise<void> {
  try {
    const { SecureStore, options } = await keychain();
    if (value) await SecureStore.setItemAsync(TOKENS_KEY, JSON.stringify(value), options);
    else await SecureStore.deleteItemAsync(TOKENS_KEY, options);
  } catch {
    // Failing to persist costs the next launch a sign-in, not this session.
  }
}

/**
 * A token a background run can call the API with, or null.
 *
 * Refreshes when the stored one is spent and writes the rotated pair straight back —
 * a refresh token is single-use, so a run that refreshed and did not persist would
 * leave the app holding one the server has already retired.
 *
 * A revoked account is the one failure worth recording: the tokens are cleared, so
 * the app opens showing the integration as disconnected rather than retrying a
 * grant that will never be given again.
 */
export async function backgroundAccessToken(): Promise<string | null> {
  const stored = await readStoredAuth();
  if (!stored) return null;
  if (!isExpired(stored.tokens)) return stored.tokens.accessToken;
  if (!stored.tokens.refreshToken) return null;

  try {
    const next = await refreshTokens(stored.tokens.refreshToken);
    await writeStoredAuth({ tokens: next, account: stored.account });
    return next.accessToken;
  } catch (e) {
    if (e instanceof AuthRevokedError) await writeStoredAuth(null);
    return null;
  }
}
