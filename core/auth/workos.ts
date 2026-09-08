/**
 * WorkOS AuthKit — the OAuth side of the AgroExact integration.
 *
 * AgroExact hosts an AuthKit application; signing in means opening its hosted page,
 * coming back on the app's own URL scheme, and trading the returned code for an
 * access token. That token is what the AgroExact API is called with, so from here on
 * "connected" means "we hold a token this module can keep alive".
 *
 * The client id and the AuthKit domain are public by design — a native app cannot
 * keep a secret, which is exactly why the flow is PKCE and there is no client secret
 * anywhere in this file.
 *
 * Everything here is plain `fetch` over the documented endpoints rather than a call
 * into `expo-auth-session`, so the token lifecycle can be unit-tested without a
 * browser. `state/auth.tsx` is the only place that opens one.
 */
import { SourceError, type FetchOptions } from '../sources/http';

export const WORKOS_CLIENT_ID = 'client_01M1ZV32C8HCQA1KKHRF5VCMSZ';
export const AUTHKIT_DOMAIN = 'https://courageous-trinket-62.authkit.app';

/**
 * `offline_access` is the one that matters: without it AuthKit returns no refresh
 * token, and the integration would silently drop out an hour after signing in.
 */
export const OAUTH_SCOPES = ['openid', 'profile', 'email', 'offline_access'];

/** The AuthKit endpoints, as OIDC discovery would report them. */
export const AUTHKIT_ENDPOINTS = {
  authorizationEndpoint: `${AUTHKIT_DOMAIN}/oauth2/authorize`,
  tokenEndpoint: `${AUTHKIT_DOMAIN}/oauth2/token`,
  userInfoEndpoint: `${AUTHKIT_DOMAIN}/oauth2/userinfo`,
  revocationEndpoint: `${AUTHKIT_DOMAIN}/oauth2/revoke`,
  endSessionEndpoint: `${AUTHKIT_DOMAIN}/oauth2/logout`,
};

/** What is kept in secure storage once a sign-in has succeeded. */
export interface AuthTokens {
  accessToken: string;
  /** Absent when AuthKit was asked for, or granted, no `offline_access`. */
  refreshToken: string | null;
  /** Epoch milliseconds. Compared against the clock, never trusted to the second. */
  expiresAtMs: number;
}

/** Who is signed in, for the settings row. Purely cosmetic. */
export interface AuthAccount {
  email: string | null;
  name: string | null;
}

interface TokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
}

/**
 * A token is treated as expired a minute early.
 *
 * The clock on the device and the clock at WorkOS are not the same clock, and a
 * request that leaves valid can still arrive expired. Refreshing a minute early
 * costs one extra call an hour; not doing it costs a failed load.
 */
export const EXPIRY_SKEW_MS = 60_000;

export function isExpired(tokens: AuthTokens, nowMs = Date.now()): boolean {
  return !tokens.accessToken || tokens.expiresAtMs - EXPIRY_SKEW_MS <= nowMs;
}

/**
 * Thrown when WorkOS rejects a refresh outright — a revoked or reused refresh
 * token, or an application that no longer exists.
 *
 * Distinguished from a network failure on purpose: the first means the integration
 * is disconnected and the user has to sign in again, the second means try later.
 * Treating one as the other either logs people out on a train, or leaves a dead
 * integration looking healthy.
 */
export class AuthRevokedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthRevokedError';
  }
}

async function postForm(
  url: string,
  body: Record<string, string>,
  opts: FetchOptions = {}
): Promise<TokenResponse> {
  const { signal, fetchImpl = fetch } = opts;
  const form = Object.entries(body)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');

  const r = await fetchImpl(url, {
    method: 'POST',
    signal,
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: form,
  });

  let json: TokenResponse = {};
  try {
    json = (await r.json()) as TokenResponse;
  } catch {
    // A body that is not JSON is reported through the status below.
  }

  if (!r.ok || json.error) {
    const detail = json.error_description ?? json.error ?? `HTTP ${r.status}`;
    // 400 with `invalid_grant` is OAuth's way of saying "this grant is dead".
    if (r.status === 400 || r.status === 401) throw new AuthRevokedError(detail);
    throw new SourceError('AgroExact-login', detail, r.status);
  }
  return json;
}

function toTokens(res: TokenResponse, nowMs: number, previousRefresh: string | null): AuthTokens {
  if (!res.access_token) throw new AuthRevokedError('geen access token ontvangen');
  return {
    accessToken: res.access_token,
    // WorkOS rotates refresh tokens; where it does not send a new one the old one
    // stays valid, and dropping it here would end the session at the next refresh.
    refreshToken: res.refresh_token ?? previousRefresh,
    expiresAtMs: nowMs + (res.expires_in ?? 3600) * 1000,
  };
}

/** Trade the authorization code for tokens. `codeVerifier` is the PKCE half held
 *  by the app; `redirectUri` must be byte-identical to the one sent to /authorize. */
export async function exchangeCode(
  params: { code: string; codeVerifier: string; redirectUri: string },
  opts: FetchOptions = {},
  nowMs = Date.now()
): Promise<AuthTokens> {
  const res = await postForm(
    AUTHKIT_ENDPOINTS.tokenEndpoint,
    {
      grant_type: 'authorization_code',
      client_id: WORKOS_CLIENT_ID,
      code: params.code,
      code_verifier: params.codeVerifier,
      redirect_uri: params.redirectUri,
    },
    opts
  );
  return toTokens(res, nowMs, null);
}

/** Exchange a refresh token for a fresh access token. Throws `AuthRevokedError`
 *  when the grant is gone, which is the signal to disconnect the integration. */
export async function refreshTokens(
  refreshToken: string,
  opts: FetchOptions = {},
  nowMs = Date.now()
): Promise<AuthTokens> {
  const res = await postForm(
    AUTHKIT_ENDPOINTS.tokenEndpoint,
    {
      grant_type: 'refresh_token',
      client_id: WORKOS_CLIENT_ID,
      refresh_token: refreshToken,
    },
    opts
  );
  return toTokens(res, nowMs, refreshToken);
}

/** Who the token belongs to. Failure is not fatal: the integration works without a
 *  name against it, so the settings row simply says "Verbonden". */
export async function fetchAccount(
  accessToken: string,
  opts: FetchOptions = {}
): Promise<AuthAccount> {
  const { signal, fetchImpl = fetch } = opts;
  try {
    const r = await fetchImpl(AUTHKIT_ENDPOINTS.userInfoEndpoint, {
      signal,
      headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
    });
    if (!r.ok) return { email: null, name: null };
    const j = (await r.json()) as { email?: string; name?: string; given_name?: string };
    return {
      email: j.email ?? null,
      name: j.name ?? j.given_name ?? null,
    };
  } catch {
    return { email: null, name: null };
  }
}
