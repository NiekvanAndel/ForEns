/**
 * The AgroExact sign-in, minus the browser.
 *
 * `state/auth.tsx` opens the AuthKit page and holds the keychain; everything that
 * can be got wrong without a device is in `core/auth/workos` — how a code becomes a
 * token, when a token counts as spent, and the difference between "the network is
 * down" and "this grant is dead". That last distinction decides whether someone is
 * signed out on a train, so it is pinned here.
 */
import { describe, it, expect, vi } from 'vitest';
import {
  AUTHKIT_DOMAIN, AUTHKIT_ENDPOINTS, AuthRevokedError, WORKOS_CLIENT_ID,
  exchangeCode, fetchAccount, isExpired, refreshTokens, revokeTokens,
} from '../core/auth/workos';
import { SourceError } from '../core/sources/http';

interface Call { url: string; body: Record<string, string>; }

/** A stand-in for `fetch` that records the form it was posted. */
function mockToken(response: { status?: number; body: unknown }) {
  const calls: Call[] = [];
  const impl = vi.fn(async (url: string, init?: { body?: string }) => {
    const body = Object.fromEntries(new URLSearchParams(init?.body ?? ''));
    calls.push({ url, body });
    return {
      ok: (response.status ?? 200) < 400,
      status: response.status ?? 200,
      json: async () => response.body,
    } as unknown as Response;
  });
  return { impl: impl as unknown as typeof fetch, calls };
}

describe('AuthKit configuration', () => {
  it('points at the AgroExact application', () => {
    expect(WORKOS_CLIENT_ID).toMatch(/^client_/);
    expect(AUTHKIT_ENDPOINTS.authorizationEndpoint).toBe(`${AUTHKIT_DOMAIN}/oauth2/authorize`);
    expect(AUTHKIT_ENDPOINTS.tokenEndpoint).toBe(`${AUTHKIT_DOMAIN}/oauth2/token`);
  });
});

describe('exchangeCode', () => {
  it('sends the PKCE verifier and no client secret', async () => {
    const { impl, calls } = mockToken({
      body: { access_token: 'at', refresh_token: 'rt', expires_in: 3600 },
    });
    const tokens = await exchangeCode(
      { code: 'the-code', codeVerifier: 'verifier', redirectUri: 'exactcast://oauth/agroexact' },
      { fetchImpl: impl },
      1_000_000
    );

    expect(calls[0]!.url).toBe(AUTHKIT_ENDPOINTS.tokenEndpoint);
    expect(calls[0]!.body).toMatchObject({
      grant_type: 'authorization_code',
      client_id: WORKOS_CLIENT_ID,
      code: 'the-code',
      code_verifier: 'verifier',
      redirect_uri: 'exactcast://oauth/agroexact',
    });
    // A native app cannot keep one, which is the whole reason the flow is PKCE.
    expect(calls[0]!.body.client_secret).toBeUndefined();
    expect(tokens).toEqual({ accessToken: 'at', refreshToken: 'rt', expiresAtMs: 1_000_000 + 3600_000 });
  });

  it('treats a rejected code as a dead grant, not a transport failure', async () => {
    const { impl } = mockToken({ status: 400, body: { error: 'invalid_grant' } });
    await expect(
      exchangeCode({ code: 'x', codeVerifier: 'v', redirectUri: 'r' }, { fetchImpl: impl })
    ).rejects.toBeInstanceOf(AuthRevokedError);
  });

  it('reports a server failure as something to try again', async () => {
    const { impl } = mockToken({ status: 503, body: {} });
    const err = await exchangeCode({ code: 'x', codeVerifier: 'v', redirectUri: 'r' }, { fetchImpl: impl })
      .catch((e) => e);
    expect(err).toBeInstanceOf(SourceError);
    expect(err).not.toBeInstanceOf(AuthRevokedError);
  });
});

describe('refreshTokens', () => {
  it('keeps the old refresh token when WorkOS does not rotate it', async () => {
    const { impl, calls } = mockToken({ body: { access_token: 'at2', expires_in: 300 } });
    const tokens = await refreshTokens('rt', { fetchImpl: impl }, 5_000);

    expect(calls[0]!.body).toMatchObject({ grant_type: 'refresh_token', refresh_token: 'rt' });
    // Dropping it here would end the session at the next refresh instead of this one.
    expect(tokens.refreshToken).toBe('rt');
    expect(tokens.accessToken).toBe('at2');
  });

  it('takes the rotated refresh token when there is one', async () => {
    const { impl } = mockToken({ body: { access_token: 'at2', refresh_token: 'rt2', expires_in: 300 } });
    expect((await refreshTokens('rt', { fetchImpl: impl })).refreshToken).toBe('rt2');
  });

  it('reports a revoked or reused refresh token as revoked', async () => {
    const { impl } = mockToken({ status: 400, body: { error: 'invalid_grant', error_description: 'expired' } });
    await expect(refreshTokens('rt', { fetchImpl: impl })).rejects.toBeInstanceOf(AuthRevokedError);
  });

  it('refuses a 200 that carries no token', async () => {
    const { impl } = mockToken({ body: { token_type: 'Bearer' } });
    await expect(refreshTokens('rt', { fetchImpl: impl })).rejects.toBeInstanceOf(AuthRevokedError);
  });
});

describe('isExpired', () => {
  const tokens = { accessToken: 'at', refreshToken: 'rt', expiresAtMs: 1_000_000 };

  it('expires a minute early, because two clocks are never the same clock', () => {
    expect(isExpired(tokens, 1_000_000 - 120_000)).toBe(false);
    expect(isExpired(tokens, 1_000_000 - 30_000)).toBe(true);
    expect(isExpired(tokens, 1_000_000 + 1)).toBe(true);
  });

  it('treats a missing token as spent', () => {
    expect(isExpired({ ...tokens, accessToken: '' }, 0)).toBe(true);
  });
});

describe('fetchAccount', () => {
  it('reads the signed-in email', async () => {
    const impl = vi.fn(async () => ({
      ok: true, status: 200, json: async () => ({ email: 'niek@agroexact.nl', name: 'Niek' }),
    })) as unknown as typeof fetch;
    expect(await fetchAccount('at', { fetchImpl: impl })).toEqual({
      email: 'niek@agroexact.nl', name: 'Niek',
    });
  });

  it('is not fatal when userinfo is unavailable', async () => {
    const impl = vi.fn(async () => { throw new Error('offline'); }) as unknown as typeof fetch;
    // The integration works perfectly well without a name against it.
    expect(await fetchAccount('at', { fetchImpl: impl })).toEqual({ email: null, name: null });
  });
});

describe('revokeTokens', () => {
  const tokens = { accessToken: 'a', refreshToken: 'r', expiresAtMs: 0 };

  it('revokes the refresh token, which takes the grant with it', async () => {
    let body = '';
    const f = vi.fn(async (_url: string, init?: { body?: string }) => {
      body = init?.body ?? '';
      return { ok: true, status: 200, json: async () => ({}) } as unknown as Response;
    });
    await revokeTokens(tokens, { fetchImpl: f as unknown as typeof fetch });
    expect(f.mock.calls[0]?.[0]).toBe(AUTHKIT_ENDPOINTS.revocationEndpoint);
    expect(body).toContain('token=r');
    expect(body).toContain('token_type_hint=refresh_token');
    expect(body).toContain(`client_id=${WORKOS_CLIENT_ID}`);
  });

  it('falls back to the access token when there is no refresh token', async () => {
    let body = '';
    const f = vi.fn(async (_url: string, init?: { body?: string }) => {
      body = init?.body ?? '';
      return { ok: true, status: 200, json: async () => ({}) } as unknown as Response;
    });
    await revokeTokens({ ...tokens, refreshToken: null }, { fetchImpl: f as unknown as typeof fetch });
    expect(body).toContain('token=a');
    expect(body).toContain('token_type_hint=access_token');
  });

  it('never throws, because signing out has already happened', async () => {
    const f = vi.fn(async () => { throw new Error('offline'); });
    await expect(revokeTokens(tokens, { fetchImpl: f as unknown as typeof fetch })).resolves.toBeUndefined();
  });
});
