/**
 * The basis version as a list of switches, and what each part may notify about.
 *
 * Two things are being pinned. That every component of the basis version can be
 * switched off on its own — including the two that predate the list, the warnings and
 * the disease models — and that a notification passes three separate gates: the reader
 * asked for it, the component is on, and, for the add-on, the tier is licensed.
 *
 * The three gates are the part worth testing hardest. They are genuinely different
 * questions — "stop working this out" is not "stop waking me about it" — and
 * collapsing any two of them would make one of them unsayable.
 */
import { describe, it, expect } from 'vitest';
import {
  BASIS_COMPONENTS, basisComponentOn, enabledBasisComponents, isAdviceComponent,
  toggleBasisComponent,
} from '../core/basisLayer';
import {
  BASIS_NOTIFY_TOPICS, INTEL_NOTIFY_TOPICS, NOTIFY_TOPICS, allowedNotifyTopics,
  isIntelTopic, notifyAllowed, notifyRequested, toggleNotifyTopic,
} from '../core/notifyScope';
import { buildRegistration, registrationDigest } from '../core/push';
import { DEFAULT_PREFS, type Prefs } from '../core/prefs';

const prefs = (over: Partial<Prefs> = {}): Prefs => ({ ...DEFAULT_PREFS, ...over });

describe('the basis version as a list', () => {
  it('lists the two that predate the list beside the four that did not', () => {
    expect(BASIS_COMPONENTS).toEqual([
      'alerts', 'disease', 'spray', 'frost', 'workability', 'fertilise',
    ]);
  });

  it('starts with everything on', () => {
    expect(enabledBasisComponents(DEFAULT_PREFS)).toEqual([...BASIS_COMPONENTS]);
  });

  it('switches the warnings through their own field, as they always did', () => {
    // Moving them into the advice layer would have migrated a stored preference for
    // tidiness and cost every device that had set it.
    const off = toggleBasisComponent(DEFAULT_PREFS, 'alerts');
    expect(off).toEqual({ alertsEnabled: false });
    expect(basisComponentOn(prefs(off), 'alerts')).toBe(false);
    // And leaves the conclusions alone.
    expect(basisComponentOn(prefs(off), 'disease')).toBe(true);
  });

  it('switches a conclusion through the advice layer', () => {
    const off = toggleBasisComponent(DEFAULT_PREFS, 'disease');
    expect(off.advice?.hidden).toEqual(['disease']);
    expect(basisComponentOn(prefs(off), 'disease')).toBe(false);
    expect(basisComponentOn(prefs(off), 'spray')).toBe(true);
    expect(basisComponentOn(prefs(off), 'alerts')).toBe(true);
  });

  it('takes every conclusion down with the master switch, and leaves the warnings', () => {
    const quiet = prefs({ advice: { enabled: false, hidden: [] } });
    expect(enabledBasisComponents(quiet)).toEqual(['alerts']);
    expect(BASIS_COMPONENTS.filter(isAdviceComponent)).not.toContain('alerts');
  });
});

describe('what may notify', () => {
  it('covers both tiers, and not the window comparison', () => {
    expect(BASIS_NOTIFY_TOPICS).toEqual(['disease', 'spray', 'frost', 'workability', 'fertilise']);
    expect(INTEL_NOTIFY_TOPICS).toEqual(['area', 'risk']);
    // A comparison of three days is a way of looking, not a moment to be told about.
    expect(NOTIFY_TOPICS).not.toContain('windows');
  });

  it('sends nothing nobody asked for', () => {
    // Opt-in throughout: a push nobody asked for is how an app gets its notifications
    // switched off wholesale.
    expect(DEFAULT_PREFS.notifyAgro).toEqual([]);
    expect(allowedNotifyTopics(DEFAULT_PREFS)).toEqual([]);
    expect(notifyRequested(DEFAULT_PREFS, 'spray')).toBe(false);
  });

  it('keeps asking-for and switching-on as separate answers', () => {
    // Asked for, component on: it sends.
    const asked = prefs({ notifyAgro: ['spray'] });
    expect(notifyAllowed(asked, 'spray')).toBe(true);

    // Component off: the request survives in storage, and nothing is sent. Switching
    // the family back on must not need the notification to be set again.
    const familyOff = prefs({
      notifyAgro: ['spray'],
      advice: { enabled: true, hidden: ['spray'] },
    });
    expect(notifyRequested(familyOff, 'spray')).toBe(true);
    expect(notifyAllowed(familyOff, 'spray')).toBe(false);
  });

  it('will not let the add-on speak without the add-on', () => {
    const asked = prefs({ notifyAgro: ['area', 'risk'] });
    expect(notifyAllowed(asked, 'area')).toBe(false);

    const licensed = prefs({
      notifyAgro: ['area', 'risk'],
      agroIntel: { enabled: true, risk: 'normal' },
    });
    expect(allowedNotifyTopics(licensed)).toEqual(['area', 'risk']);
    expect(isIntelTopic('area')).toBe(true);
    expect(isIntelTopic('disease')).toBe(false);
  });

  it('asks and stops asking', () => {
    expect(toggleNotifyTopic([], 'frost')).toEqual(['frost']);
    expect(toggleNotifyTopic(['frost', 'area'], 'frost')).toEqual(['area']);
  });
});

describe('what the registration carries', () => {
  const base = prefs({
    alertsEnabled: true,
    pushEnabled: true,
    locations: [{ name: 'Heesch', lat: 51.73, lon: 5.53 }],
  });
  const opts = { token: 'ExponentPushToken[abc]', tzOffsetSec: 7200, appVersion: '0.1' };

  it('carries the agro topics in their own field, in a stable order', () => {
    // `frost` means two different things on the two lists — a region's significant
    // weather, and a field's own boundary — so they are two arrays and neither name
    // has to be bent on the wire.
    const reg = buildRegistration(
      prefs({ ...base, notifyFrost: true, notifyAgro: ['frost', 'disease'] }),
      opts
    )!;
    expect(reg.kinds).toEqual(['frost']);
    expect(reg.agroKinds).toEqual(['disease', 'frost']);
  });

  it('registers a device that wants nothing but a Smith period', () => {
    // Any of the three halves is reason enough: the weather kinds, the reader's own
    // rules, or an agro topic.
    const reg = buildRegistration(prefs({ ...base, notifyAgro: ['disease'] }), opts);
    expect(reg?.agroKinds).toEqual(['disease']);
    expect(reg?.kinds).toEqual([]);
  });

  it('sends nothing for a topic whose component is off', () => {
    const reg = buildRegistration(
      prefs({
        ...base,
        notifyAgro: ['spray', 'disease'],
        advice: { enabled: true, hidden: ['spray'] },
      }),
      opts
    )!;
    expect(reg.agroKinds).toEqual(['disease']);
  });

  it('still registers nothing at all when the warnings are off', () => {
    // The warnings' switch has governed every notification since before this list
    // existed, and it keeps doing so: with it off there is nothing to send.
    expect(buildRegistration(
      prefs({ ...base, alertsEnabled: false, notifyAgro: ['disease'] }),
      opts
    )).toBeNull();
  });

  it('re-registers when the topics change', () => {
    const one = buildRegistration(prefs({ ...base, notifyAgro: ['disease'] }), opts);
    const two = buildRegistration(prefs({ ...base, notifyAgro: ['disease', 'workability'] }), opts);
    expect(registrationDigest(one)).not.toBe(registrationDigest(two));
  });
});
