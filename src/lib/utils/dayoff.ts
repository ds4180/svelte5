/**
 * ============================================================================
 * [결근/휴무 날짜·연속휴무 그룹화 및 스타일 헬퍼 (src/lib/utils/dayoff.ts)]
 * ============================================================================
 */

import { timestampToDateString } from '$lib/utils';

export interface DayoffAdminEntry {
	id: number;
	user_id: number;
	username: string;
	real_name: string;
	primary_group?: string;
	rank_level?: number;
	work_type?: 'FCFS' | 'APPROVAL' | string;
	date: string;
	type: string;
	status: string;
	memo?: string;
	group_id?: string;
	create_date?: string;
}

export interface DayoffSpan {
	spanKey: string;
	startDate: string;
	endDate: string;
	isMultiDay: boolean;
	firstEntry: DayoffAdminEntry;
	entries: DayoffAdminEntry[];
	entryByDate: Map<string, DayoffAdminEntry>;
}

export const DAYOFF_TYPE_LABELS: Record<string, string> = {
	ANNUAL: '연차',
	SICK: '병가',
	SPECIAL: '경조사',
	OFFICIAL: '공가'
};

export const getDayoffTypeLabel = (t: string): string => DAYOFF_TYPE_LABELS[t] || t;

/** 'YYYY-MM-DD' 다음 날짜 문자열 */
export function nextDayStr(dateStr: string): string {
	const [y, m, d] = dateStr.split('-').map(Number);
	return timestampToDateString(new Date(y, m - 1, d + 1).getTime());
}

/** 시작일~종료일 날짜 배열 생성 */
export function getDatesInRange(s: string, e?: string, maxDays = 180): string[] {
	if (!s) return [];
	const end = e && e >= s ? e : s;
	const [sy, sm, sd] = s.split('-').map(Number);
	const [ey, em, ed] = end.split('-').map(Number);
	const cur = new Date(sy, sm - 1, sd);
	const last = new Date(ey, em - 1, ed);
	const list: string[] = [];
	while (cur <= last && list.length < maxDays) {
		list.push(timestampToDateString(cur.getTime()));
		cur.setDate(cur.getDate() + 1);
	}
	return list;
}

/**
 * 동일 신청 묶음(사원 + group_id + 휴무유형 + 상태) 중 연속 날짜를 하나의 Span으로 병합합니다.
 */
export function groupConsecutiveDayoffs(
	list: DayoffAdminEntry[],
	statusFilter: string
): DayoffSpan[] {
	const buckets = new Map<string, DayoffAdminEntry[]>();

	for (const d of list || []) {
		if (!d?.date || d.status === 'CANCELLED' || d.status === 'REJECTED') continue;
		if (statusFilter !== 'ALL' && d.status !== statusFilter) continue;

		const key = `${d.user_id}|${d.group_id ?? `single-${d.id}`}|${d.type}|${d.status}`;
		const arr = buckets.get(key) || [];
		arr.push(d);
		buckets.set(key, arr);
	}

	const spans: DayoffSpan[] = [];

	for (const [key, rows] of buckets) {
		const sorted = [...rows].sort((a, b) => a.date.localeCompare(b.date));
		let runRows = [sorted[0]];
		let prev = sorted[0];

		const pushRun = (groupRows: DayoffAdminEntry[]) => {
			const startRow = groupRows[0];
			const endRow = groupRows[groupRows.length - 1];
			const entryByDate = new Map<string, DayoffAdminEntry>();
			for (const r of groupRows) {
				if (!entryByDate.has(r.date)) entryByDate.set(r.date, r);
			}
			spans.push({
				spanKey: `${key}@${startRow.date}`,
				startDate: startRow.date,
				endDate: endRow.date,
				isMultiDay: endRow.date !== startRow.date,
				firstEntry: startRow,
				entries: groupRows,
				entryByDate
			});
		};

		for (let i = 1; i < sorted.length; i++) {
			const cur = sorted[i];
			if (cur.date === prev.date) continue;
			if (cur.date === nextDayStr(prev.date)) {
				runRows.push(cur);
				prev = cur;
			} else {
				pushRun(runRows);
				runRows = [cur];
				prev = cur;
			}
		}
		pushRun(runRows);
	}

	return spans.sort((a, b) => a.startDate.localeCompare(b.startDate));
}

export const getDayColor = (dow: number): string =>
	dow === 0 ? 'text-rose-500' : dow === 6 ? 'text-blue-500' : 'text-slate-900';

export const getDayLabel = (dow: number): string => ['일', '월', '화', '수', '목', '금', '토'][dow];

export const getDayoffBadgeClass = (s: string): string => {
	if (s === 'REQUESTED') return 'bg-amber-100 text-amber-700 border-amber-200';
	if (s === 'APPROVED') return 'bg-emerald-100 text-emerald-700 border-emerald-200';
	if (s === 'REJECTED') return 'bg-rose-100 text-rose-700 border-rose-200';
	return 'bg-slate-100 text-slate-500 border-slate-200';
};
