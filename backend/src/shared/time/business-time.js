import { DateTime } from 'luxon';

export const DEFAULT_BUSINESS_TIME_ZONE = 'America/Montevideo';

export function businessDayRange(date, zone = DEFAULT_BUSINESS_TIME_ZONE) {
  const value = DateTime.fromISO(date, { zone });
  if (!value.isValid) throw new Error(`Invalid business date: ${date}`);
  return {
    from: value.startOf('day').toUTC().toJSDate(),
    to: value.endOf('day').toUTC().toJSDate(),
  };
}

export function currentBusinessPeriods(zone = DEFAULT_BUSINESS_TIME_ZONE, now = new Date()) {
  const current = DateTime.fromJSDate(now, { zone });
  if (!current.isValid) throw new Error(`Invalid business time zone: ${zone}`);
  return {
    dayStart: current.startOf('day').toUTC().toJSDate(),
    monthStart: current.startOf('month').toUTC().toJSDate(),
  };
}
