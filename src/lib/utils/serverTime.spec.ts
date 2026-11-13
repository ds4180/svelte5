import { describe, it, expect } from 'vitest';
import {
	getKstTimeSnapshot,
	shiftCalendarDateStr,
	parseDateStrAsLocalDate
} from './serverTime';
import { formatDDay } from '$lib/utils';

describe('serverTime utilities', () => {
	it('computes KST snapshot across UTC midnight boundary', () => {
		// 2026-11-13T15:30:00Z is 2026-11-14T00:30:00+09:00 in Asia/Seoul
		const utcInstant = new Date('2026-11-13T15:30:00.000Z');
		const snapshot = getKstTimeSnapshot(utcInstant);

		expect(snapshot).toEqual({
			year: 2026,
			month: 10, // 0-indexed November
			day: 14,
			hours: 0,
			minutes: 30,
			minutesOfDay: 30,
			dateStr: '2026-11-14'
		});
	});

	it('uses h23 zero-hour formatting at KST midnight instead of 24:00', () => {
		// 2026-01-01T15:05:00Z is 2026-01-02T00:05:00+09:00
		const snapshot = getKstTimeSnapshot(new Date('2026-01-01T15:05:00.000Z'));

		expect(snapshot.hours).toBe(0);
		expect(snapshot.minutes).toBe(5);
		expect(snapshot.minutesOfDay).toBe(5);
		expect(snapshot.dateStr).toBe('2026-01-02');
	});

	it('shifts calendar date strings accurately across month and leap-year boundaries', () => {
		expect(shiftCalendarDateStr('2026-11-14', -1)).toBe('2026-11-13');
		expect(shiftCalendarDateStr('2026-11-30', 1)).toBe('2026-12-01');
		expect(shiftCalendarDateStr('2026-03-01', -1)).toBe('2026-02-28');
		expect(shiftCalendarDateStr('2024-03-01', -1)).toBe('2024-02-29');
		expect(shiftCalendarDateStr('2026-12-31', 1)).toBe('2027-01-01');
	});

	it('parses YYYY-MM-DD as local calendar midnight without UTC off-by-one shift', () => {
		const parsed = parseDateStrAsLocalDate('2026-11-14');

		expect(parsed.getFullYear()).toBe(2026);
		expect(parsed.getMonth()).toBe(10);
		expect(parsed.getDate()).toBe(14);
		expect(parsed.getHours()).toBe(0);
		expect(parsed.getMinutes()).toBe(0);
		expect(parsed.getSeconds()).toBe(0);
	});
});

describe('formatDDay with deterministic referenceDate', () => {
	it('computes identical D-day strings across string and Date inputs for matching calendar days', () => {
		const sameDay = formatDDay('2026-11-14', '2026-11-14');
		const future2 = formatDDay('2026-11-16', '2026-11-14');
		const past3 = formatDDay('2026-11-11', '2026-11-14');

		expect(sameDay).toMatch(/^D-day$/i);
		expect(future2).toBe('D-2');
		expect(past3).toBe('D+3');
	});

	it('produces timezone-independent results when both target and reference are YYYY-MM-DD strings', () => {
		const shiftedRef = formatDDay('2026-12-01', '2026-11-28');
		expect(shiftedRef).toBe('D-3');
		expect(formatDDay('2026-12-01', parseDateStrAsLocalDate('2026-11-28'))).toBe('D-3');
	});
});
