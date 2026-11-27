/**
 * ============================================================================
 * [결근·휴무 관리자 비즈니스 서비스 레이어 (src/lib/services/dayoffAdminService.ts)]
 * ============================================================================
 * 💡 역할:
 * - `/v1/admin/dayoff`의 통계 집계, 필터/정렬, 캘린더 이벤트 변환, 타임라인 트랙 배정,
 *   정책·예외정원 저장 및 워크스페이스 데이터 로드 로직을 UI로부터 분리합니다.
 */

import * as dayoffApi from '$lib/api/dayoff';
import type { DayoffEntry, DayoffMonthlyQuotaDay, DayoffPolicy } from '$lib/api/dayoff';
import { timestampToDateString } from '$lib/utils';
import {
	getDatesInRange,
	getDayoffStatusLabel,
	getDayoffTypeLabel,
	groupConsecutiveDayoffs,
	type DayoffSpan
} from '$lib/utils/dayoff';

export type WorkTypeFilter = 'ALL' | 'APPROVAL' | 'FCFS';
export type RecordStatusFilter = 'ALL' | 'REQUESTED' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
export type RecordTypeFilter = 'ALL' | 'ANNUAL' | 'SICK' | 'SPECIAL' | 'OFFICIAL';
export type RecordSortOption = 'date_desc' | 'date_asc' | 'created_desc' | 'name_asc';

export interface DayoffRecordFilterState {
	search: string;
	status: RecordStatusFilter;
	type: RecordTypeFilter;
	group: string;
	startDate: string;
	endDate: string;
	sort: RecordSortOption;
}

export interface DayoffDisplaySettings {
	show_quota_bg_alarm: boolean;
	notify_on_request: boolean;
	notify_on_result: boolean;
}

export const DEFAULT_DAYOFF_DISPLAY_SETTINGS: DayoffDisplaySettings = {
	show_quota_bg_alarm: true,
	notify_on_request: true,
	notify_on_result: true
};

export function createDefaultDayoffPolicy(effectiveDate: string): DayoffPolicy {
	return {
		effective_date: effectiveDate,
		classify_mode: 'BOTH',
		fcfs_groups: [],
		fcfs_ranks: [1],
		daily_quota: 3,
		max_monthly_count: 0,
		max_days_per_request: 0,
		min_advance_days: 0,
		max_advance_days: 0,
		etc: {}
	};
}

export function extractDisplaySettings(policy?: DayoffPolicy | null): DayoffDisplaySettings {
	const etc = policy?.etc && typeof policy.etc === 'object' ? policy.etc : {};
	return {
		show_quota_bg_alarm: etc.show_quota_bg_alarm !== false,
		notify_on_request: etc.notify_on_request !== false,
		notify_on_result: etc.notify_on_result !== false
	};
}

export function computeWorkTypeCounts(dayoffs: DayoffEntry[]) {
	const fcfs = dayoffs.filter((d) => d.work_type === 'FCFS').length;
	return {
		all: dayoffs.length,
		fcfs,
		approval: dayoffs.length - fcfs
	};
}

export function computeDayoffMonthlyStats(
	filteredDayoffs: DayoffEntry[],
	year: number,
	monthZeroBased: number
) {
	const monthPrefix = `${year}-${String(monthZeroBased + 1).padStart(2, '0')}-`;
	const approvedThisMonth = filteredDayoffs.filter(
		(d) => d.status === 'APPROVED' && d.date?.startsWith(monthPrefix)
	);
	const requested = filteredDayoffs.filter((d) => d.status === 'REQUESTED');
	return {
		total: filteredDayoffs.length,
		approvedCount: approvedThisMonth.length,
		requestedCount: requested.length,
		fcfsApprovedThisMonth: approvedThisMonth.filter((d) => d.work_type === 'FCFS').length,
		officeApprovedThisMonth: approvedThisMonth.filter((d) => d.work_type !== 'FCFS').length,
		typeStats: {
			ANNUAL: approvedThisMonth.filter((d) => d.type === 'ANNUAL').length,
			SICK: approvedThisMonth.filter((d) => d.type === 'SICK').length,
			SPECIAL: approvedThisMonth.filter((d) => d.type === 'SPECIAL').length,
			OFFICIAL: approvedThisMonth.filter((d) => d.type === 'OFFICIAL').length
		}
	};
}

export function filterAndSortDayoffRecords(
	filteredDayoffs: DayoffEntry[],
	f: DayoffRecordFilterState
): DayoffEntry[] {
	const q = f.search.trim().toLowerCase();
	const list = filteredDayoffs.filter((d) => {
		if (f.status !== 'ALL' && d.status !== f.status) return false;
		if (f.type !== 'ALL' && d.type !== f.type) return false;
		if (f.group !== 'ALL' && (d.primary_group || '미지정') !== f.group) return false;
		if (f.startDate && d.date < f.startDate) return false;
		if (f.endDate && d.date > f.endDate) return false;
		if (q) {
			const haystack = [
				d.real_name,
				d.username,
				d.primary_group,
				d.date,
				d.memo,
				getDayoffTypeLabel(d.type),
				getDayoffStatusLabel(d.status)
			]
				.filter(Boolean)
				.join(' ')
				.toLowerCase();
			if (!haystack.includes(q)) return false;
		}
		return true;
	});

	const sorted = [...list];
	if (f.sort === 'date_desc') {
		sorted.sort((a, b) => (b.date || '').localeCompare(a.date || '') || b.id - a.id);
	} else if (f.sort === 'date_asc') {
		sorted.sort((a, b) => (a.date || '').localeCompare(b.date || '') || a.id - b.id);
	} else if (f.sort === 'created_desc') {
		sorted.sort((a, b) => (b.create_date || '').localeCompare(a.create_date || '') || b.id - a.id);
	} else if (f.sort === 'name_asc') {
		sorted.sort((a, b) =>
			(a.real_name || a.username || '').localeCompare(b.real_name || b.username || '', 'ko')
		);
	}
	return sorted;
}

export function summarizeDayoffRecords(records: DayoffEntry[]) {
	let approved = 0;
	let requested = 0;
	let rejected = 0;
	let cancelled = 0;
	for (const d of records) {
		if (d.status === 'APPROVED') approved++;
		else if (d.status === 'REQUESTED') requested++;
		else if (d.status === 'REJECTED') rejected++;
		else if (d.status === 'CANCELLED') cancelled++;
	}
	return { total: records.length, approved, requested, rejected, cancelled };
}

export function buildDayoffCalendarEvents(params: {
	filteredDayoffs: DayoffEntry[];
	monthlyQuotaDays: Record<string, DayoffMonthlyQuotaDay>;
	statusFilter: string;
	showQuotaBgAlarm?: boolean;
}) {
	const { filteredDayoffs, monthlyQuotaDays, statusFilter, showQuotaBgAlarm = true } = params;
	const spans = groupConsecutiveDayoffs(filteredDayoffs, statusFilter);
	const events: any[] = [];

	if (showQuotaBgAlarm) {
		for (const [dStr, qInfo] of Object.entries(monthlyQuotaDays || {})) {
			if (!qInfo) continue;
			if (qInfo.is_full) {
				events.push({
					id: `admin-quota-full-${dStr}`,
					date: dStr,
					title:
						qInfo.quota === 0
							? '선착순 신청불가 (정원 0명)'
							: `운전직 마감 (${qInfo.approved_count}/${qInfo.quota}명)`,
					type: 'DANGER',
					display: 'background',
					badge: '마감'
				});
			} else if (qInfo.is_override) {
				events.push({
					id: `admin-quota-override-${dStr}`,
					date: dStr,
					title: `⚡예외정원 ${qInfo.approved_count}/${qInfo.quota}명`,
					type: 'INFO',
					display: 'background',
					badge: `정원${qInfo.quota}`
				});
			}
		}
	}

	for (const sp of spans) {
		const startRow = sp.firstEntry;
		const staffName = startRow.real_name || startRow.username || `사원#${startRow.user_id}`;
		const typeLabel = getDayoffTypeLabel(startRow.type);
		const isApproved = startRow.status === 'APPROVED';
		const isFcfs = startRow.work_type === 'FCFS';
		events.push({
			id: sp.spanKey,
			date: sp.startDate,
			endDate: sp.isMultiDay ? sp.endDate : null,
			title: `${isFcfs ? '🚌' : '🏢'}${staffName} (${typeLabel})`,
			type: isApproved ? 'SUCCESS' : 'WARNING',
			display: 'bar',
			badge: isApproved ? (isFcfs ? '선착순' : '승인') : '대기',
			raw: startRow
		});
	}

	return events;
}

export function computeSelectedDateQuotaInfo(params: {
	selectedDate: string | null;
	monthlyQuotaDays: Record<string, DayoffMonthlyQuotaDay>;
	dateOverrides: Record<string, number>;
	policy: DayoffPolicy;
	allDayoffs: DayoffEntry[];
}) {
	const { selectedDate, monthlyQuotaDays, dateOverrides, policy, allDayoffs } = params;
	if (!selectedDate) return null;
	const dayFromServer = monthlyQuotaDays?.[selectedDate];
	const isOverride = dayFromServer
		? Boolean(dayFromServer.is_override)
		: selectedDate in (dateOverrides || {});
	const baseQuota = Number(policy?.daily_quota ?? 3);
	const quota = dayFromServer
		? Number(dayFromServer.quota)
		: isOverride
			? Number(dateOverrides[selectedDate])
			: baseQuota;
	const approvedFcfsCount = allDayoffs.filter(
		(d) => d.date === selectedDate && d.status === 'APPROVED' && d.work_type === 'FCFS'
	).length;
	return {
		date: selectedDate,
		quota,
		baseQuota,
		effectiveDate: dayFromServer?.effective_date || policy?.effective_date,
		isOverride,
		approvedCount: approvedFcfsCount,
		remaining: Math.max(0, quota - approvedFcfsCount),
		isFull: approvedFcfsCount >= quota
	};
}

export interface TimelineMonthMeta {
	year: number;
	monthIndex: number;
	monthNum: number;
	key: string;
	label: string;
}

export function computeTimelineStartStr(
	selectedYear: number,
	selectedMonth: number,
	todayStr: string
): string {
	const [ty, tm, td] = String(todayStr).split('-').map(Number);
	if (selectedYear === ty && selectedMonth === tm - 1) {
		return timestampToDateString(new Date(ty, tm - 1, td - 5).getTime());
	}
	return `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-01`;
}

export function buildTimelineMonthsMeta(
	selectedYear: number,
	selectedMonth: number,
	timelineStartStr: string,
	monthsCount: number
): TimelineMonthMeta[] {
	const list: TimelineMonthMeta[] = [];
	const startMonthStr = timelineStartStr.slice(0, 7);
	const selectedMonthStr = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}`;
	if (startMonthStr < selectedMonthStr) {
		const [py, pm] = startMonthStr.split('-').map(Number);
		list.push({
			year: py,
			monthIndex: pm - 1,
			monthNum: pm,
			key: `${py}-${pm}`,
			label: `${py}년 ${pm}월`
		});
	}
	for (let offset = 0; offset < monthsCount; offset++) {
		const dt = new Date(selectedYear, selectedMonth + offset, 1);
		const y = dt.getFullYear();
		const mIdx = dt.getMonth();
		const mNum = mIdx + 1;
		list.push({
			year: y,
			monthIndex: mIdx,
			monthNum: mNum,
			key: `${y}-${mNum}`,
			label: `${y}년 ${mNum}월`
		});
	}
	return list;
}

export function buildTimelineLayout(params: {
	filteredDayoffs: DayoffEntry[];
	statusFilter: string;
	timelineStartStr: string;
	timelineMonths: TimelineMonthMeta[];
	todayStr: string;
	timelineQuotaDays: Record<string, DayoffMonthlyQuotaDay>;
}) {
	const {
		filteredDayoffs,
		statusFilter,
		timelineStartStr,
		timelineMonths,
		todayStr,
		timelineQuotaDays
	} = params;

	if (timelineMonths.length === 0) {
		return { days: [], maxTrackCount: 0, totalEntries: 0 };
	}

	const lastMonth = timelineMonths[timelineMonths.length - 1];
	const rangeStartStr = timelineStartStr;
	const endMonthLastDay = new Date(lastMonth.year, lastMonth.monthIndex + 1, 0).getDate();
	const rangeEndStr = `${lastMonth.year}-${String(lastMonth.monthNum).padStart(2, '0')}-${String(endMonthLastDay).padStart(2, '0')}`;

	const spans: DayoffSpan[] = groupConsecutiveDayoffs(filteredDayoffs, statusFilter).filter(
		(sp) => sp.endDate >= rangeStartStr && sp.startDate <= rangeEndStr
	);
	spans.sort((a, b) => {
		const aMulti = a.isMultiDay ? 1 : 0;
		const bMulti = b.isMultiDay ? 1 : 0;
		if (aMulti !== bMulti) return bMulti - aMulti;
		if (a.startDate !== b.startDate) return a.startDate.localeCompare(b.startDate);
		if (a.endDate !== b.endDate) return b.endDate.localeCompare(a.endDate);
		const aName = a.firstEntry.real_name || a.firstEntry.username || '';
		const bName = b.firstEntry.real_name || b.firstEntry.username || '';
		return aName.localeCompare(bName);
	});

	const tracksByDate = new Map<string, Array<any | null>>();
	let maxTrackCount = 0;

	for (const sp of spans) {
		const visStart = sp.startDate < rangeStartStr ? rangeStartStr : sp.startDate;
		const visEnd = sp.endDate > rangeEndStr ? rangeEndStr : sp.endDate;
		const visDays = getDatesInRange(visStart, visEnd, 800);
		if (visDays.length === 0) continue;

		let trackIndex = 0;
		while (true) {
			const isFree = visDays.every((dStr) => {
				const rowTracks = tracksByDate.get(dStr);
				return !rowTracks || !rowTracks[trackIndex];
			});
			if (isFree) break;
			trackIndex++;
		}

		if (trackIndex + 1 > maxTrackCount) maxTrackCount = trackIndex + 1;

		for (let idx = 0; idx < visDays.length; idx++) {
			const dStr = visDays[idx];
			const rowTracks = tracksByDate.get(dStr) || [];
			while (rowTracks.length <= trackIndex) rowTracks.push(null);
			const entry = sp.entryByDate.get(dStr) || sp.firstEntry;
			rowTracks[trackIndex] = {
				span: sp,
				entry,
				trackIndex,
				dayNumberInSpan: idx + 1,
				totalDaysInSpan: sp.entries.length,
				isStart: dStr === sp.startDate,
				isEnd: dStr === sp.endDate,
				isVisibleFirst: idx === 0,
				isVisibleLast: idx === visDays.length - 1,
				isMultiDay: sp.isMultiDay
			};
			tracksByDate.set(dStr, rowTracks);
		}
	}

	const days: Array<{
		date: string;
		year: number;
		monthNum: number;
		day: number;
		dayOfWeek: number;
		isToday: boolean;
		isMonthStart: boolean;
		qInfo: DayoffMonthlyQuotaDay | undefined;
		tracks: Array<any | null>;
		activeCount: number;
	}> = [];
	let totalEntries = 0;

	for (const dateStr of getDatesInRange(rangeStartStr, rangeEndStr, 800)) {
		const [y, mNum, d] = dateStr.split('-').map(Number);
		const dayOfWeek = new Date(y, mNum - 1, d).getDay();
		const tracks = tracksByDate.get(dateStr) || [];
		const activeCount = tracks.reduce((acc, s) => (s ? acc + 1 : acc), 0);
		totalEntries += activeCount;
		days.push({
			date: dateStr,
			year: y,
			monthNum: mNum,
			day: d,
			dayOfWeek,
			isToday: dateStr === todayStr,
			isMonthStart: d === 1,
			qInfo: timelineQuotaDays[dateStr],
			tracks,
			activeCount
		});
	}

	return { days, maxTrackCount, totalEntries };
}

export function getTimelineSlotStyle(entry: DayoffEntry) {
	if (entry.status === 'REQUESTED') {
		return {
			line: 'bg-amber-400',
			lineActive: 'bg-amber-500 ring-2 ring-amber-200',
			chip: 'border-amber-300 bg-amber-50 text-amber-900',
			avatar: 'bg-amber-500',
			dot: 'bg-amber-500',
			subText: 'text-amber-700'
		};
	}
	if (entry.work_type === 'FCFS') {
		return {
			line: 'bg-emerald-500',
			lineActive: 'bg-emerald-600 ring-2 ring-emerald-200',
			chip: 'border-emerald-200 bg-white text-slate-900',
			avatar: 'bg-emerald-700',
			dot: 'bg-emerald-600',
			subText: 'text-emerald-700'
		};
	}
	return {
		line: 'bg-blue-600',
		lineActive: 'bg-blue-700 ring-2 ring-blue-200',
		chip: 'border-slate-200 bg-white text-slate-900',
		avatar: 'bg-slate-900',
		dot: 'bg-blue-600',
		subText: 'text-blue-600'
	};
}

export async function loadDayoffWorkspace(year: number, monthNum: number) {
	const [dayoffRes, policyRes] = await Promise.all([
		dayoffApi.adminGetAllDayoffs<any>(),
		dayoffApi.adminGetDayoffPolicy(year, monthNum)
	]);
	const dayoffs: DayoffEntry[] = Array.isArray(dayoffRes) ? dayoffRes : dayoffRes?.data || [];
	const basePolicy = policyRes?.today_policy || policyRes?.policy || null;
	return {
		dayoffs,
		policy: basePolicy,
		reservedPolicy: policyRes?.reserved_policy ?? null,
		dateOverrides: policyRes?.date_overrides || {},
		availableGroups: Array.isArray(policyRes?.available_groups) ? policyRes.available_groups : null,
		monthlyQuotaDays: policyRes?.monthly_quota?.days || {}
	};
}
