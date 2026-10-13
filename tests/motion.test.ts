import { describe, expect, it } from 'vitest';
import { project, rubberband, shouldCommit, springConfig } from '../core/motion';

describe('project', () => {
  it('matches the exponential-decay form', () => {
    // 1000 pt/s at 0.998: (1 * 0.998) / 0.002 = 499 pt
    expect(project(1000)).toBeCloseTo(499, 5);
  });
  it('keeps the sign and is zero at rest', () => {
    expect(project(-1000)).toBeCloseTo(-499, 5);
    expect(project(0)).toBe(0);
  });
});

describe('rubberband', () => {
  it('is zero at the edge and always less than the raw overshoot', () => {
    expect(rubberband(0, 400)).toBe(0);
    expect(rubberband(100, 400)).toBeLessThan(100);
    expect(rubberband(100, 400)).toBeGreaterThan(0);
  });
  it('is mirrored for the other edge', () => {
    expect(rubberband(-100, 400)).toBeCloseTo(-rubberband(100, 400), 10);
  });
  it('never reaches a fixed fraction of the dimension', () => {
    expect(rubberband(1e6, 400)).toBeLessThan(400);
  });
});

describe('springConfig', () => {
  it('is critically damped when the ratio is 1', () => {
    const { mass, stiffness, damping } = springConfig(1, 0.4);
    expect(damping).toBeCloseTo(2 * Math.sqrt(stiffness * mass), 8);
  });
  it('is under-damped below 1', () => {
    const { mass, stiffness, damping } = springConfig(0.8, 0.3);
    expect(damping).toBeLessThan(2 * Math.sqrt(stiffness * mass));
  });
});

describe('shouldCommit', () => {
  it('commits a short fast flick', () => {
    expect(shouldCommit(40, 1500, 100)).toBe(true);
  });
  it('rejects a long drag that is heading back', () => {
    expect(shouldCommit(120, -1500, 100)).toBe(false);
  });
  it('rejects a short slow drag', () => {
    expect(shouldCommit(30, 50, 100)).toBe(false);
  });
});
