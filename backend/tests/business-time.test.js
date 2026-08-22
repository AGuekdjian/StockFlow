import { describe, expect, it } from 'vitest';
import { businessDayRange, currentBusinessPeriods } from '../src/shared/time/business-time.js';

describe('business time', () => {
  it('converts a complete Montevideo business day to UTC', () => {
    const range = businessDayRange('2026-08-22', 'America/Montevideo');
    expect(range.from.toISOString()).toBe('2026-08-22T03:00:00.000Z');
    expect(range.to.toISOString()).toBe('2026-08-23T02:59:59.999Z');
  });

  it('uses business-local day and month boundaries', () => {
    const periods = currentBusinessPeriods(
      'America/Montevideo',
      new Date('2026-08-22T01:00:00.000Z'),
    );
    expect(periods.dayStart.toISOString()).toBe('2026-08-21T03:00:00.000Z');
    expect(periods.monthStart.toISOString()).toBe('2026-08-01T03:00:00.000Z');
  });
});
