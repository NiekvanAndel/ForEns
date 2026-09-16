/**
 * The push registration: what is sent, when, and what is not.
 *
 * All of `core/push` is pure so that this can exist at all — the server does not yet,
 * and these are what say the device's half is right before anyone builds it.
 */
import { describe, expect, it } from 'vitest';
import {
  buildRegistration, classifyPermission, httpTransport, registrationDigest, syncAction,
  syncRegistration, type PushRegistration, type PushTransport,
} from '../core/push';
import { DEFAULT_PREFS } from '../core/prefs';

const ON = {
  ...DEFAULT_PREFS,
  alertsEnabled: true,
  pushEnabled: true,
  notifyRain: true,
  locations: [{ name: 'Wageningen', lat: 51.96851, lon: 5.66546 }],
};
const opts = { token: 'ExponentPushToken[abc]', tzOffsetSec: 7200, appVersion: '0.1' };

describe('buildRegistration', () => {
  it('describes the device the server has to reach', () => {
    const reg = buildRegistration(ON, opts)!;
    expect(reg.v).toBe(1);
    expect(reg.token).toBe('ExponentPushToken[abc]');
    // Rain and storm share one preference, as they do in the alert itself.
    expect(reg.kinds).toEqual(['rain', 'storm']);
    expect(reg.places).toEqual([{ name: 'Wageningen', lat: 51.969, lon: 5.665 }]);
    expect(reg.lang).toBe('nl');
    expect(reg.tzOffsetSec).toBe(7200);
  });

  it('rounds a coordinate to about a hundred metres', () => {
    // A forecast does not change below that, and a registration is a thing held on
    // a server: there is no reason for it to carry a doorstep.
    const reg = buildRegistration(ON, opts)!;
    expect(reg.places[0]!.lat).toBe(51.969);
  });

  it('is null wherever there is nothing to register', () => {
    // Each of these is the deregistration case, and the caller treats it as one.
    expect(buildRegistration({ ...ON, pushEnabled: false }, opts)).toBeNull();
    expect(buildRegistration({ ...ON, alertsEnabled: false }, opts)).toBeNull();
    expect(buildRegistration({ ...ON, notifyRain: false }, opts)).toBeNull();
    expect(buildRegistration({ ...ON, locations: [] }, opts)).toBeNull();
    expect(buildRegistration(ON, { ...opts, token: '' })).toBeNull();
  });

  it('routes a storm through the rain preference, as the alert does', () => {
    const reg = buildRegistration(ON, opts)!;
    expect(reg.kinds).toContain('rain');
    expect(reg.kinds).toContain('storm');
  });

  it('orders the kinds, so the same preferences always hash the same', () => {
    const a = buildRegistration({ ...ON, notifyWind: true, notifyFrost: true }, opts)!;
    const b = buildRegistration({ ...ON, notifyFrost: true, notifyWind: true }, opts)!;
    expect(a.kinds).toEqual([...a.kinds].sort());
    expect(registrationDigest(a)).toBe(registrationDigest(b));
  });
});

describe('registrationDigest', () => {
  it('ignores the app version', () => {
    // Otherwise every release would re-register every device for nothing.
    const a = buildRegistration(ON, opts)!;
    const b = buildRegistration(ON, { ...opts, appVersion: '9.9' })!;
    expect(registrationDigest(a)).toBe(registrationDigest(b));
  });

  it('notices what the server acts on', () => {
    const base = buildRegistration(ON, opts)!;
    const changes: PushRegistration[] = [
      buildRegistration({ ...ON, notifyWind: true }, opts)!,
      buildRegistration({ ...ON, lang: 'en' }, opts)!,
      buildRegistration({ ...ON, quietHours: !ON.quietHours }, opts)!,
      buildRegistration({ ...ON, locations: [{ name: 'X', lat: 52, lon: 5 }] }, opts)!,
      buildRegistration(ON, { ...opts, token: 'other' })!,
      buildRegistration(ON, { ...opts, tzOffsetSec: 0 })!,
    ];
    for (const c of changes) expect(registrationDigest(c)).not.toBe(registrationDigest(base));
  });
});

describe('syncAction', () => {
  const reg = buildRegistration(ON, opts)!;
  const digest = registrationDigest(reg);

  it('sends nothing when nothing changed', () => {
    expect(syncAction(reg, digest)).toBe('none');
  });

  it('registers a change and deregisters a withdrawal', () => {
    expect(syncAction(reg, null)).toBe('register');
    expect(syncAction(null, digest)).toBe('unregister');
  });

  it('does not deregister a device that was never registered', () => {
    // The state a phone is in before anyone touches the toggle: push off, nothing
    // ever sent. A DELETE there is a request for no reason.
    expect(syncAction(null, null)).toBe('none');
    expect(syncAction(null, 'none')).toBe('none');
  });
});

describe('syncRegistration', () => {
  const reg = buildRegistration(ON, opts)!;
  const spyTransport = (fail = false): PushTransport & { calls: string[] } => {
    const calls: string[] = [];
    return {
      calls,
      async register() {
        calls.push('register');
        if (fail) throw new Error('nope');
      },
      async unregister() {
        calls.push('unregister');
        if (fail) throw new Error('nope');
      },
    };
  };

  it('records the digest only once the server has it', async () => {
    const t = spyTransport();
    const r = await syncRegistration(reg, null, t);
    expect(t.calls).toEqual(['register']);
    expect(r.ok).toBe(true);
    expect(r.digest).toBe(registrationDigest(reg));
  });

  it('leaves the digest alone on a failure, so the next run tries again', async () => {
    // The worst of the three possible states is a toggle that is on, a server that
    // has never heard of the device, and an app that thinks it is done.
    const t = spyTransport(true);
    const r = await syncRegistration(reg, null, t);
    expect(r.ok).toBe(false);
    expect(r.digest).toBe('none');
    expect(syncAction(reg, r.digest)).toBe('register');
  });

  it('sends nothing at all when the registration is unchanged', async () => {
    const t = spyTransport();
    const r = await syncRegistration(reg, registrationDigest(reg), t);
    expect(t.calls).toEqual([]);
    expect(r.action).toBe('none');
  });

  it('can deregister with the token it was last registered under', async () => {
    const t = spyTransport();
    await syncRegistration(null, registrationDigest(reg), t, reg.token);
    expect(t.calls).toEqual(['unregister']);
  });
});

describe('httpTransport', () => {
  /** A fetch that records what it was asked for, since that is the whole contract. */
  const recorder = (status = 204) => {
    const calls: { url: string; init: RequestInit }[] = [];
    const impl = (async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return new Response(null, { status });
    }) as unknown as typeof fetch;
    return { calls, impl };
  };

  it('posts a registration and deletes by token', async () => {
    const { calls, impl } = recorder();
    const t = httpTransport('https://push.example/v1/', impl);

    await t.register(buildRegistration(ON, opts)!);
    expect(calls[0]!.url).toBe('https://push.example/v1/registrations');
    expect(calls[0]!.init.method).toBe('POST');
    expect(JSON.parse(calls[0]!.init.body as string).token).toBe(opts.token);

    // A token is a bracketed string, so it has to survive being put in a path.
    await t.unregister('ExponentPushToken[a b]');
    expect(calls[1]!.url).toBe(
      'https://push.example/v1/registrations/ExponentPushToken%5Ba%20b%5D'
    );
    expect(calls[1]!.init.method).toBe('DELETE');
  });

  it('treats a non-2xx as a failure, so the digest is not advanced', async () => {
    const { impl } = recorder(500);
    const t = httpTransport('https://push.example', impl);
    await expect(t.register(buildRegistration(ON, opts)!)).rejects.toThrow();
  });
});

describe('classifyPermission', () => {
  it('takes a standing grant without asking again', () => {
    expect(classifyPermission({ granted: true }, null)).toBe('granted');
  });

  it('is granted once the prompt is answered yes', () => {
    expect(classifyPermission({ granted: false, status: 'undetermined' }, { granted: true, status: 'granted' }))
      .toBe('granted');
  });

  it('is denied only where somebody actually said no', () => {
    expect(classifyPermission({ granted: false }, { granted: false, status: 'denied' })).toBe('denied');
  });

  it('calls an unanswerable ask unavailable, not a refusal', () => {
    // The bug this exists to prevent: Expo Go cannot present the prompt, iOS answers
    // `undetermined`, and a developer who granted permission was told they had
    // refused it — with a switch that would not move however often they tapped.
    expect(classifyPermission({ granted: false }, { granted: false, status: 'undetermined' }))
      .toBe('unavailable');
    // And a runtime with no notification module at all reaches here with nothing.
    expect(classifyPermission(null, null)).toBe('unavailable');
    expect(classifyPermission({ granted: false }, null)).toBe('unavailable');
  });
});
