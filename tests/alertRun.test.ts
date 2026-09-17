/**
 * Evaluating the reader's own rules in the background.
 *
 * The judgement is all here — which rules tripped, and which of those are worth
 * saying out loud — so it can be tested without a network, a keychain or a phone.
 */
import { describe, expect, it } from 'vitest';
import { REARM_AFTER_MS, runUserAlerts, sanitiseStates, type StationValue } from '../core/alertRun';
import { makeAlert, type UserAlert } from '../core/alerts';
import { stationCanAnswer, stationTileValue } from '../core/model/stationTiles';
import { fetchAlertReadings } from '../core/alertFetch';
import { planUserAlertNotification } from '../core/notifications';
import { DEFAULT_PREFS } from '../core/prefs';
import type { MeasuredHour, Measurement, StationObservations } from '../core/sources/agroexact';

const rule = (over: Partial<UserAlert> = {}): UserAlert => ({
  ...makeAlert({
    tileId: 'temp', title: 'Temperatuur', timeLabel: 'nu', kind: 'temp',
    op: 'below', value: 2, stationIds: ['s1'], stationNames: ['Hedikhuizen'],
  })!,
  ...over,
});

const at = (stationId: string, value: number | null, name = stationId): StationValue =>
  ({ stationId, stationName: name, value });

describe('runUserAlerts', () => {
  const r = rule({ id: 'r' });
  const cold = { r: [at('s1', -1)] };
  const mild = { r: [at('s1', 8)] };

  it('notifies on the edge, not on every run it stays true', () => {
    // A rule is a standing condition, not an event. "Below two" holds all night, and
    // a run every half hour saying so is how notifications get switched off.
    const first = runUserAlerts([r], cold, {}, 1000);
    expect(first.fired).toHaveLength(1);
    expect(first.states.r).toEqual({ tripped: true, firedMs: 1000 });

    const second = runUserAlerts([r], cold, first.states, 2000);
    expect(second.fired).toEqual([]);
    expect(second.states.r!.tripped).toBe(true);
  });

  it('arms again once the reading comes back', () => {
    const tripped = runUserAlerts([r], cold, {}, 1000).states;
    const cleared = runUserAlerts([r], mild, tripped, 2000);
    expect(cleared.fired).toEqual([]);
    expect(cleared.states.r!.tripped).toBe(false);

    // Two genuine crossings are two notifications.
    const again = runUserAlerts([r], cold, cleared.states, 3000);
    expect(again.fired).toHaveLength(1);
  });

  it('repeats a condition that has held for half a day', () => {
    // A frost since midnight is worth saying again by the working day, and a rule
    // that tripped while the phone was off should not stay silent for a week.
    const held = { r: { tripped: true, firedMs: 1000 } };
    expect(runUserAlerts([r], cold, held, 1000 + REARM_AFTER_MS - 1).fired).toEqual([]);
    expect(runUserAlerts([r], cold, held, 1000 + REARM_AFTER_MS).fired).toHaveLength(1);
  });

  it('keeps a rule’s memory when nothing could be read for it', () => {
    // A run that could not see is not a run that saw nothing wrong; clearing here
    // would make the next good run announce a condition that never went away.
    const tripped = runUserAlerts([r], cold, {}, 1000).states;
    const blind = runUserAlerts([r], {}, tripped, 2000);
    expect(blind.fired).toEqual([]);
    expect(blind.states.r).toEqual(tripped.r);
  });

  it('names the station furthest past the threshold', () => {
    const many = {
      r: [at('s1', 1.5, 'Eén'), at('s2', -4, 'Twee'), at('s3', 0, 'Drie')],
    };
    const out = runUserAlerts([rule({ id: 'r', stationIds: ['s1', 's2', 's3'] })], many, {}, 1);
    expect(out.fired[0]!.stationName).toBe('Twee');
    expect(out.fired[0]!.value).toBe(-4);

    const hot = rule({ id: 'r', op: 'above', value: 25, stationIds: ['s1', 's2'] });
    const warm = { r: [at('s1', 26, 'Eén'), at('s2', 31, 'Twee')] };
    expect(runUserAlerts([hot], warm, {}, 1).fired[0]!.stationName).toBe('Twee');
  });

  it('forgets a rule that is switched off', () => {
    // So switching it back on is a fresh start rather than a rule kept quiet by
    // something that happened last week.
    const off = rule({ id: 'r', enabled: false });
    const out = runUserAlerts([off], cold, { r: { tripped: true, firedMs: 1 } }, 2);
    expect(out.fired).toEqual([]);
    expect(out.states.r).toBeUndefined();
  });
});

describe('sanitiseStates', () => {
  it('drops bookkeeping for rules that no longer exist', () => {
    const r = rule({ id: 'live' });
    const out = sanitiseStates(
      { live: { tripped: true, firedMs: 5 }, gone: { tripped: true, firedMs: 5 } },
      [r]
    );
    expect(Object.keys(out)).toEqual(['live']);
  });

  it('survives anything storage hands back', () => {
    const r = rule({ id: 'live' });
    expect(sanitiseStates(null, [r])).toEqual({});
    expect(sanitiseStates('nonsense', [r])).toEqual({});
    expect(sanitiseStates({ live: null }, [r])).toEqual({});
    expect(sanitiseStates({ live: { firedMs: 'soon' } }, [r]))
      .toEqual({ live: { tripped: false, firedMs: 0 } });
  });
});

describe('stationTileValue', () => {
  const hour = (time: string, over: Partial<MeasuredHour> = {}): MeasuredHour => ({
    time, temp: 10, tempMin: null, tempMax: null, humidity: 70, humidityMin: null,
    humidityMax: null, dewpoint: 5, wind: 8, gusts: 15, windDir: 180, precip: 0,
    radiation: null, ...over,
  });
  const record = (rows: MeasuredHour[], current: Partial<Measurement> = {}) => ({
    hours: Object.fromEntries(rows.map((h) => [h.time, h])),
    current: {
      time: '2026-09-15T12:00', measTime: '2026-09-15T12:05:00Z',
      temp: 16, humidity: 80, dewpoint: 9, wind: 12, gusts: 20, windDir: 200,
      precip: 0, ...current,
    } as Measurement,
  });
  const now = '2026-09-15T12:00';

  it('reads a "nu" block off the latest measurement', () => {
    const r = record([]);
    expect(stationTileValue('temp', r, now)).toBe(16);
    expect(stationTileValue('humidity', r, now)).toBe(80);
    expect(stationTileValue('wind', r, now)).toBe(12);
    expect(stationTileValue('gust', r, now)).toBe(20);
    expect(stationTileValue('wind-dir', r, now)).toBe(200);
  });

  it('counts a rolling window back from now, not from the newest row', () => {
    // A station that stopped reporting two hours ago has measured what it measured;
    // its last 24 rows are not its last 24 hours.
    const rows = [
      hour('2026-09-15T05:00', { precip: 9 }),  // outside the six-hour window
      hour('2026-09-15T08:00', { precip: 1 }),
      hour('2026-09-15T10:00', { precip: 2 }),
    ];
    expect(stationTileValue('rain-6h', record(rows), now)).toBe(3);
    expect(stationTileValue('rain-24h', record(rows), now)).toBe(12);
  });

  it('takes the day’s extremes as far as the hours’ own spread goes', () => {
    // The coldest minute was inside some hour's minimum, not at the lowest mean —
    // the same reading `modelTiles` takes.
    const rows = [hour('2026-09-15T06:00', { temp: 8, tempMin: 4, tempMax: 9 })];
    expect(stationTileValue('temp-min', record(rows), now)).toBe(4);
    // And the latest measurement counts, since the newest hour may not be aggregated.
    expect(stationTileValue('temp-max', record(rows), now)).toBe(16);
  });

  it('keeps "today" to the calendar day', () => {
    const rows = [
      hour('2026-09-14T23:00', { gusts: 90, precip: 5 }),
      hour('2026-09-15T09:00', { gusts: 30, precip: 1 }),
    ];
    expect(stationTileValue('gust-max', record(rows), now)).toBe(30);
    expect(stationTileValue('rain-today', record(rows), now)).toBe(1);
  });

  it('has nothing to say about a forecast', () => {
    // A station has no opinion about the next hour, and a rule on one is skipped
    // rather than evaluated against something else that happens to be to hand.
    expect(stationCanAnswer('rain-next-1h')).toBe(false);
    expect(stationCanAnswer('temp')).toBe(true);
    expect(stationTileValue('rain-next-24h', record([]), now)).toBeNull();
    // And a block a later version adds that this has not learned.
    expect(stationTileValue('soil-temp', record([]), now)).toBeNull();
  });
});

describe('fetchAlertReadings', () => {
  const obs = (id: string, temp: number): StationObservations => ({
    stationId: id, stationName: `Station ${id}`, hours: {},
    current: {
      time: '2026-09-15T12:00', measTime: '2026-09-15T12:00:00Z',
      temp, humidity: null, dewpoint: null, wind: null, gusts: null,
      windDir: null, precip: null,
    },
  });

  it('fetches each station once however many rules point at it', () => {
    const asked: string[] = [];
    return fetchAlertReadings(
      [rule({ id: 'a', stationIds: ['s1'] }), rule({ id: 'b', stationIds: ['s1', 's2'] })],
      7200,
      '2026-09-15T12:00',
      {
        token: async () => 'tok',
        observations: async (_t, id) => { asked.push(id); return obs(id, 1); },
      }
    ).then((out) => {
      expect(asked.sort()).toEqual(['s1', 's2']);
      expect(out.ok).toBe(true);
      expect(out.readings.a).toHaveLength(1);
      expect(out.readings.b).toHaveLength(2);
    });
  });

  it('says nothing could be read rather than that nothing was wrong', async () => {
    // Which is what stops the caller clearing every rule's memory.
    const noAccount = await fetchAlertReadings([rule()], 0, '2026-09-15T12:00', {
      token: async () => null,
    });
    expect(noAccount.ok).toBe(false);

    const allFailed = await fetchAlertReadings([rule()], 0, '2026-09-15T12:00', {
      token: async () => 'tok',
      observations: async () => { throw new Error('timeout'); },
    });
    expect(allFailed.ok).toBe(false);
  });

  it('lets one station fail without costing the others', async () => {
    const out = await fetchAlertReadings(
      [rule({ id: 'a', stationIds: ['s1'] }), rule({ id: 'b', stationIds: ['s2'] })],
      0,
      '2026-09-15T12:00',
      {
        token: async () => 'tok',
        observations: async (_t, id) => {
          if (id === 's1') throw new Error('timeout');
          return obs(id, 1);
        },
      }
    );
    expect(out.ok).toBe(true);
    expect(out.readings.a).toBeUndefined();
    expect(out.readings.b).toHaveLength(1);
  });

  it('asks for nothing at all with no rules', async () => {
    let called = false;
    const out = await fetchAlertReadings([], 0, '2026-09-15T12:00', {
      token: async () => { called = true; return 'tok'; },
    });
    expect(called).toBe(false);
    expect(out.ok).toBe(true);
  });
});

describe('planUserAlertNotification', () => {
  const subscribed = { ...DEFAULT_PREFS, alertsEnabled: true, pushEnabled: true };
  const tripped = { alert: rule(), stationId: 's1', stationName: 'Hedikhuizen', value: -1.4 };
  const noon = Date.UTC(2026, 5, 15, 12, 0);

  it('needs the same two layers as every other notification', () => {
    expect(planUserAlertNotification(tripped, DEFAULT_PREFS, { locationName: '' })).toBeNull();
    expect(
      planUserAlertNotification(tripped, { ...subscribed, alertsEnabled: false }, { locationName: '' })
    ).toBeNull();
    expect(planUserAlertNotification(tripped, subscribed, { locationName: '', nowMs: noon }))
      .not.toBeNull();
  });

  it('names the station and both figures, in the reader’s units', () => {
    const p = planUserAlertNotification(tripped, subscribed, { locationName: '', nowMs: noon })!;
    expect(p.title).toBe('Temperatuur · Hedikhuizen');
    expect(p.body).toContain('-1,4 °C');
    expect(p.body).toContain('onder');
    expect(p.body).toContain('2 °C');

    const f = planUserAlertNotification(
      tripped, { ...subscribed, tempUnit: 'F', lang: 'en' }, { locationName: '', nowMs: noon }
    )!;
    expect(f.body).toContain('°F');
    expect(f.body).toContain('below');
  });

  it('drops rather than delays at night', () => {
    // A built-in alert is about the coming hours and keeps; this says a reading
    // crossed a line at a moment that has passed, and 07:00 is eight hours stale.
    const night = Date.UTC(2026, 5, 15, 23, 30);
    expect(planUserAlertNotification(tripped, subscribed, { locationName: '', nowMs: night }))
      .toBeNull();
    expect(
      planUserAlertNotification(
        tripped, { ...subscribed, quietHours: false }, { locationName: '', nowMs: night }
      )
    ).not.toBeNull();
  });
});
