export interface KstTimeSnapshot {
	year: number;
	/** 0-indexed month (0 = January, 11 = December) matching Date.prototype.getMonth() */
	month: number;
	day: number;
	hours: number;
	minutes: number;
	minutesOfDay: number;
	/** 'YYYY-MM-DD' in Asia/Seoul */
	dateStr: string;
}

const kstFormatter = new Intl.DateTimeFormat('en-US', {
	timeZone: 'Asia/Seoul',
	year: 'numeric',
	month: '2-digit',
	day: '2-digit',
	hour: '2-digit',
	minute: '2-digit',
	hourCycle: 'h23'
});

/**
 * Returns deterministic Asia/Seoul (KST) calendar/time components for SSR <-> CSR hydration parity.
 */
export function getKstTimeSnapshot(date: Date = new Date()): KstTimeSnapshot {
	const parts = kstFormatter.formatToParts(date);
	const getPart = (type: Intl.DateTimeFormatPartTypes): number => {
		const raw = parts.find((p) => p.type === type)?.value;
		return Number(raw ?? 0);
	};

	const year = getPart('year');
	const monthNum = getPart('month');
	const day = getPart('day');
	const hours = getPart('hour') % 24;
	const minutes = getPart('minute');

	return {
		year,
		month: monthNum - 1,
		day,
		hours,
		minutes,
		minutesOfDay: hours * 60 + minutes,
		dateStr: `${String(year).padStart(4, '0')}-${String(monthNum).padStart(2, '0')}-${String(day).padStart(2, '0')}`
	};
}

/**
 * Shifts a 'YYYY-MM-DD' string by offsetDays using pure UTC calendar math (DST/TZ-safe).
 */
export function shiftCalendarDateStr(dateStr: string, offsetDays: number): string {
	const [y, m, d] = String(dateStr).slice(0, 10).split('-').map(Number);
	if (!y || !m || !d) return '';
	const dt = new Date(Date.UTC(y, m - 1, d + Number(offsetDays || 0)));
	return dt.toISOString().slice(0, 10);
}

/**
 * Parses 'YYYY-MM-DD' into a local Date at 00:00:00.000 without UTC-midnight off-by-one shifts.
 */
export function parseDateStrAsLocalDate(dateStr: string): Date {
	const [y, m, d] = String(dateStr).slice(0, 10).split('-').map(Number);
	if (!y || !m || !d) return new Date(NaN);
	return new Date(y, m - 1, d, 0, 0, 0, 0);
}
