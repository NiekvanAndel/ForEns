import { describe, it, expect } from 'vitest';
import { hourWindow } from '../core/model/hourWindow';
import type { Hour } from '../core/model/types';

const hour = (time: string, isPast = false): Hour =>
  ({ time, temp: 15, precip: 0, wind: 10, humidity: 70, wmo: 1, isDay: 1, isPast }) as Hour;

const model = (past: number, future: number) => ({
  pastHours: Array.from({ length: past }, (_, i) => hour(`P${i}`, true)),
  futureHours: Array.from({ length: future }, (_, i) => hour(`F${i}`)),
});

describe('hourWindow', () => {
  it('puts the current hour between the observed and the forecast hours', () => {
    const { hours, nowIndex } = hourWindow(model(12, 24), { ahead: 24, behind: 6 });
    expect(hours).toHaveLength(30);
    expect(nowIndex).toBe(6);
    expect(hours[nowIndex]!.time).toBe('F0');
    expect(hours[nowIndex - 1]!.time).toBe('P11');
  });

  it('takes the most recent observations, not the oldest', () => {
    const { hours } = hourWindow(model(12, 4), { ahead: 4, behind: 3 });
    expect(hours.slice(0, 3).map((h) => h.time)).toEqual(['P9', 'P10', 'P11']);
  });

  it('asks for more history than exists without complaint', () => {
    const { hours, nowIndex } = hourWindow(model(2, 5), { ahead: 5, behind: 12 });
    expect(hours).toHaveLength(7);
    expect(nowIndex).toBe(2);
  });

  it('shows only the forecast when history is asked for and none is wanted', () => {
    const { hours, nowIndex } = hourWindow(model(12, 5), { ahead: 5, behind: 0 });
    expect(hours.map((h) => h.time)).toEqual(['F0', 'F1', 'F2', 'F3', 'F4']);
    expect(nowIndex).toBe(0);
  });

  it('falls back to the last observation when the forecast is empty', () => {
    // Not a normal state, but a failed forecast fetch must not centre past the end.
    const { hours, nowIndex } = hourWindow(model(4, 0), { ahead: 24 });
    expect(nowIndex).toBe(3);
    expect(hours[nowIndex]!.time).toBe('P3');
  });

  it('reports no current hour when there is nothing at all', () => {
    expect(hourWindow(model(0, 0), { ahead: 24 })).toEqual({ hours: [], nowIndex: -1 });
  });
});
