/**
 * ============================================================================
 * [차량 배차 관리자 비즈니스 서비스 레이어 (src/lib/services/dispatchAdminService.ts)]
 * ============================================================================
 * 💡 역할:
 * - 노선별 차량 풀 매칭(하드코딩 제거), 배차 데이터 병렬 로드(ALL/단일 통합),
 *   교대 로테이션 예측, 자동 채우기/복원, 일괄 저장 페이로드 조립을 담당합니다.
 */

import * as dispatchApi from '$lib/api/dispatch';
import type {
	DispatchRow,
	DispatchSettings,
	DriverResource,
	DriverWorkStat,
	RouteFleetRule,
	RouteMasterItem
} from '$lib/api/dispatch';
import { getDayoffTypeLabel } from '$lib/utils/dayoff';

export const DEFAULT_DRIVER_ASSIGN_COLORS = {
	reserve: { enabled: true, bg_color: '#dbeafe', text_color: '#1e40af' },
	cross: { enabled: true, bg_color: '#fde68a', text_color: '#78350f' }
};

export const DEFAULT_DISPATCH_SETTINGS: DispatchSettings = {
	preview_enabled: true,
	preview_force_open: false,
	preview_start_offset: 3,
	preview_days: 5,
	preview_open_time: '17:00',
	preview_pause_message: '배차 조정 중으로 예고 열람이 일시 중지되었습니다.',
	auto_announce_enabled: false,
	auto_announce_time: '17:00',
	auto_announce_push: true,
	auto_announce_skip_if_confirmed: true,
	route_fleet_rules: [
		{ keywords: ['121', '122'], fleet_key: '121/122' },
		{ keywords: ['291', '292', '293'], fleet_key: '291/292/293' }
	],
	show_substitute_columns: true,
	driver_assign_colors: DEFAULT_DRIVER_ASSIGN_COLORS,
	max_weekly_work_days: 4,
	weekly_basis: 'calendar_week',
	min_rest_hours: 8,
	night_metric_mode: 'turn_count',
	night_route_turn_rules: [],
	night_morning_end: '06:00',
	night_evening_start: '21:00',
	stats_include_draft: true,
	enable_validation_blink: true,
	warn_prev_day_work: true,
	auto_announce_title_template: '[명일 배차 고지] {target_date}',
	auto_announce_body_template:
		'{target_date} 배차가 확정 고지되었습니다. 배차표에서 차량과 로번을 확인해 주세요.',
	reannounce_title_template: '[명일 배차 변경 재공지] {target_date}',
	reannounce_body_template:
		'{target_date} 배차가 수정되어 재배포되었습니다. 변경된 차량과 로번을 반드시 다시 확인해 주세요.',
	announce_sender_min_rank: 4,
	confirm_d_day_always_open: true,
	confirm_d1_require_announced: true,
	preview_allow_draft: true
};

export function parseHhmmToMinutes(hhmm?: string | null): number | null {
	const s = String(hhmm || '').trim();
	const m = s.match(/^(\d{1,2}):(\d{2})$/);
	if (!m) return null;
	return Number(m[1]) * 60 + Number(m[2]);
}

export interface DriverComplianceResult {
	isViolation: boolean;
	reasons: string[];
	stat: DriverWorkStat;
}

const EMPTY_STAT: DriverWorkStat = {
	name: '',
	month_work_days: 0,
	week_work_days: 0,
	month_work_minutes: 0,
	month_night_count: 0,
	month_night_minutes: 0,
	prev_end_time: null,
	worked_yesterday: false,
	consecutive_off_days: 3,
	earliest_today_min: null,
	earliest_available_time: null,
	dayoff_type: null,
	dayoff_status: null,
	is_disciplined: false
};

/** 기사 배정 정합성 검증 (투입은 항상 허용하되, 위반 사유와 블링크 경고 여부를 판정) */
export function buildDuplicateDriverSet(
	dispatchRows: DispatchRow[],
	otherRouteAssignedDrivers: string[] = [],
	isHideRecommendations = false
): Set<string> {
	const counts = new Map<string, number>();
	for (const row of dispatchRows) {
		if (isHideRecommendations && row.is_inherited) continue;
		const name = String(row.driver_name || '').trim();
		if (!name) continue;
		counts.set(name, (counts.get(name) ?? 0) + 1);
	}
	for (const other of otherRouteAssignedDrivers) {
		const name = String(other || '').trim();
		if (!name) continue;
		counts.set(name, (counts.get(name) ?? 0) + 1);
	}
	const dup = new Set<string>();
	for (const [name, cnt] of counts.entries()) {
		if (cnt >= 2) dup.add(name);
	}
	return dup;
}

export function evaluateDriverCompliance(params: {
	driverName?: string | null;
	driverStats: Record<string, DriverWorkStat>;
	settings: DispatchSettings;
	rowStartTime?: string | null;
	isRegularDuty?: boolean;
	isDuplicateToday?: boolean;
}): DriverComplianceResult {
	const name = String(params.driverName || '').trim();
	const stat = (name && params.driverStats[name]) || { ...EMPTY_STAT, name };
	const reasons: string[] = [];

	if (stat.is_disciplined) reasons.push('징계');
	if (stat.dayoff_type === 'SICK') {
		reasons.push('병가');
	} else if (stat.dayoff_type) {
		reasons.push(getDayoffTypeLabel(stat.dayoff_type));
	}

	const maxWeek = params.settings.max_weekly_work_days ?? 4;
	if (stat.week_work_days >= maxWeek) {
		reasons.push(`주${stat.week_work_days}일`);
	}

	const earliest = stat.earliest_today_min;
	let hasRestWarning = false;
	if (earliest !== null && earliest > 0) {
		const rowStartMin = parseHhmmToMinutes(params.rowStartTime);
		if (rowStartMin !== null) {
			if (rowStartMin < earliest) {
				reasons.push(`휴식미달(${stat.earliest_available_time}~)`);
				hasRestWarning = true;
			}
		} else {
			reasons.push(`가능 ${stat.earliest_available_time}~`);
			hasRestWarning = true;
		}
	}

	if (
		!params.isRegularDuty &&
		(params.settings.warn_prev_day_work ?? true) &&
		(stat.worked_yesterday || Boolean(stat.prev_end_time)) &&
		!hasRestWarning
	) {
		reasons.push('전일근무');
	}

	if (params.isDuplicateToday) {
		reasons.push('중복배정');
	}

	return {
		isViolation: reasons.length > 0,
		reasons,
		stat
	};
}

export interface ClassifiedDriverItem {
	driver: DriverResource;
	stat: DriverWorkStat;
	reasons: string[];
	hasPolicyWarning: boolean;
}

/** 4단계 그룹(예비 -> 고정 -> 결근계 -> 병가/징계) + 그룹 내 공정 배차 정렬 */
export function buildClassifiedDriverBoard(params: {
	availableDrivers: DriverResource[];
	driverStats: Record<string, DriverWorkStat>;
	settings: DispatchSettings;
}) {
	const { availableDrivers, driverStats, settings } = params;
	const nightMode = settings.night_metric_mode || 'turn_count';

	const toItem = (driver: DriverResource): ClassifiedDriverItem => {
		const comp = evaluateDriverCompliance({
			driverName: driver.name,
			driverStats,
			settings
		});
		return {
			driver,
			stat: comp.stat,
			reasons: comp.reasons,
			hasPolicyWarning: comp.isViolation
		};
	};

	const sortFair = (a: ClassifiedDriverItem, b: ClassifiedDriverItem) => {
		if (a.stat.month_work_days !== b.stat.month_work_days) {
			return a.stat.month_work_days - b.stat.month_work_days;
		}
		if (a.stat.month_work_minutes !== b.stat.month_work_minutes) {
			return a.stat.month_work_minutes - b.stat.month_work_minutes;
		}
		const aNight =
			nightMode === 'time_range' ? a.stat.month_night_minutes : a.stat.month_night_count;
		const bNight =
			nightMode === 'time_range' ? b.stat.month_night_minutes : b.stat.month_night_count;
		if (aNight !== bNight) return aNight - bNight;
		return a.driver.name.localeCompare(b.driver.name, 'ko');
	};

	const reserve: ClassifiedDriverItem[] = [];
	const fixed: ClassifiedDriverItem[] = [];
	const dayoff: ClassifiedDriverItem[] = [];
	const sickDiscipline: ClassifiedDriverItem[] = [];

	for (const drv of availableDrivers) {
		const item = toItem(drv);
		if (item.stat.is_disciplined || item.stat.dayoff_type === 'SICK') {
			sickDiscipline.push(item);
		} else if (item.stat.dayoff_type) {
			dayoff.push(item);
		} else if (!String(drv.vehicle_no || '').trim()) {
			reserve.push(item);
		} else {
			fixed.push(item);
		}
	}

	reserve.sort(sortFair);
	fixed.sort(sortFair);
	dayoff.sort(sortFair);
	sickDiscipline.sort(sortFair);

	return { reserve, fixed, dayoff, sickDiscipline };
}

/** 설정된 규칙(route_fleet_rules)으로 노선명에 해당하는 전담 차량 목록을 반환합니다. */
export function resolveRouteFleet(
	routeName: string,
	vehiclesByGroup: Record<string, string[]>,
	rules: RouteFleetRule[]
): string[] {
	const name = String(routeName || '');
	for (const rule of rules || []) {
		if ((rule.keywords || []).some((kw) => kw && name.includes(kw))) {
			return vehiclesByGroup[rule.fleet_key] || [];
		}
	}
	return Object.values(vehiclesByGroup || {}).flat();
}

export function getAlternatePartner(
	driver: DriverResource | null | undefined,
	driverPool: DriverResource[]
): DriverResource | null {
	if (!driver || !driver.vehicle_no) return null;
	if (driver.role === 'MAIN') {
		return driverPool.find((d) => d.vehicle_no === driver.vehicle_no && d.role === 'SUB') || null;
	}
	if (driver.role === 'SUB') {
		return driverPool.find((d) => d.vehicle_no === driver.vehicle_no && d.role === 'MAIN') || null;
	}
	return null;
}

/** 내일 기사 예측 컬럼 재계산 (당연근무 연속 / 고정차량 일치 시 MAIN↔SUB 교대 로테이션) */
export function computeTomorrowPredictions(
	rows: DispatchRow[],
	driverPool: DriverResource[]
): DispatchRow[] {
	if (!rows.length) return rows;
	return rows.map((row) => {
		const updated = { ...row };
		if (updated.tomorrow_driver_name && !updated.is_tomorrow_inherited) {
			return updated;
		}
		if (updated.is_regular_duty) {
			if (updated.driver_name && updated.driver_name.trim()) {
				updated.tomorrow_driver_name = updated.driver_name.trim();
				updated.is_tomorrow_inherited = true;
			} else {
				updated.tomorrow_driver_name = '';
				updated.is_tomorrow_inherited = false;
			}
			return updated;
		}

		if (updated.driver_name && updated.driver_name.trim()) {
			const todayObj = driverPool.find((d) => d.name === updated.driver_name?.trim());
			const rowVno = String(updated.vehicle_no || '').trim();
			if (
				todayObj &&
				rowVno &&
				String(todayObj.vehicle_no || '').trim() === rowVno &&
				(todayObj.role === 'MAIN' || todayObj.role === 'SUB')
			) {
				const partner = getAlternatePartner(todayObj, driverPool);
				updated.tomorrow_driver_name = partner ? partner.name : '';
				updated.is_tomorrow_inherited = Boolean(partner);
			} else {
				updated.tomorrow_driver_name = '';
				updated.is_tomorrow_inherited = false;
			}
		} else {
			updated.tomorrow_driver_name = '';
			updated.is_tomorrow_inherited = false;
		}
		return updated;
	});
}

/** 자동 채우기 및 취소 복원 */
export function toggleAutoFillDispatch(params: {
	rows: DispatchRow[];
	originalRows: DispatchRow[];
	isAutoFilled: boolean;
	driverPool: DriverResource[];
	driverStats?: Record<string, DriverWorkStat>;
}): { rows: DispatchRow[]; originalRows: DispatchRow[]; isAutoFilled: boolean } {
	const { rows, originalRows, isAutoFilled, driverPool, driverStats } = params;
	if (!rows.length) return { rows, originalRows, isAutoFilled };

	if (isAutoFilled) {
		const restored = rows.map((row, idx) => {
			const orig = originalRows[idx];
			if (!orig) return row;
			return {
				...row,
				driver_name: orig.is_inherited ? '' : orig.driver_name,
				is_inherited: false,
				tomorrow_driver_name: orig.is_tomorrow_inherited ? '' : orig.tomorrow_driver_name,
				is_tomorrow_inherited: false,
				vehicle_no: orig.vehicle_no,
				start_time: orig.start_time,
				memo: orig.memo
			};
		});
		return { rows: restored, originalRows, isAutoFilled: false };
	}

	const backup: DispatchRow[] = JSON.parse(JSON.stringify(rows));
	const step1 = rows.map((row) => {
		const updated = { ...row };
		const isBlank = !updated.driver_name || !updated.driver_name.trim();
		if (isBlank) {
			const yesterdayName = updated.yesterday_driver_name || '';
			if (!yesterdayName) {
				updated.driver_name = '';
			} else if (updated.is_yesterday_regular_duty) {
				updated.driver_name = yesterdayName;
			} else {
				const ydObj = driverPool.find((d) => d.name === yesterdayName);
				const rowVno = String(updated.vehicle_no || '').trim();
				if (
					ydObj &&
					rowVno &&
					String(ydObj.vehicle_no || '').trim() === rowVno &&
					(ydObj.role === 'MAIN' || ydObj.role === 'SUB')
				) {
					const partner = driverPool.find(
						(d) =>
							String(d.vehicle_no || '').trim() === rowVno &&
							d.role === (ydObj.role === 'MAIN' ? 'SUB' : 'MAIN')
					);
					const st = partner ? driverStats?.[partner.name] : undefined;
					const isUnavailable = Boolean(st?.dayoff_type || st?.is_disciplined);
					updated.driver_name = partner && !isUnavailable ? partner.name : '';
				} else {
					updated.driver_name = '';
				}
			}
		}
		updated.is_inherited = false;
		return updated;
	});

	const step2 = computeTomorrowPredictions(step1, driverPool).map((r) => ({
		...r,
		is_tomorrow_inherited: false
	}));

	return { rows: step2, originalRows: backup, isAutoFilled: true };
}

/** ALL / 단일 노선 배차 데이터 통합 로더 (중복 제거) */
export async function fetchDispatchForRoutes(params: {
	dateKey: string;
	targetRoutes: RouteMasterItem[];
	vehiclesByGroup: Record<string, string[]>;
	routeFleetRules: RouteFleetRule[];
	isAdmin?: boolean;
	customFetchFn?: (dateKey: string, routeId: number) => Promise<DispatchRow[]>;
}): Promise<DispatchRow[]> {
	const {
		dateKey,
		targetRoutes,
		vehiclesByGroup,
		routeFleetRules,
		isAdmin = true,
		customFetchFn
	} = params;

	const fetcher = isAdmin
		? (d: string, id: number) => dispatchApi.adminGetDailyDispatch(d, id)
		: customFetchFn!;

	const results = await Promise.all(
		targetRoutes
			.filter((r) => typeof r.id === 'number')
			.map(async (r) => {
				try {
					const data = await fetcher(dateKey, r.id as number);
					const fleet = resolveRouteFleet(r.route_name || '', vehiclesByGroup, routeFleetRules);
					return (data || []).map((row: DispatchRow, idx: number) => ({
						...row,
						route_id: r.id as number,
						route_name: r.route_name,
						vehicle_no: row.vehicle_no || fleet[idx] || ''
					}));
				} catch (e) {
					console.error(`❌ [${r.route_name}] 노선 로드 실패:`, e);
					return [];
				}
			})
	);
	return results.flat();
}

export function buildDispatchSavePayloads(params: {
	selectedRoute: RouteMasterItem;
	routes: RouteMasterItem[];
	dispatchRows: DispatchRow[];
	dateKey: string;
	status: 'DRAFT' | 'CONFIRMED' | 'ANNOUNCED';
}) {
	const { selectedRoute, routes, dispatchRows, dateKey, status } = params;
	const targets =
		selectedRoute.id === 'ALL' ? routes.filter((r) => typeof r.id === 'number') : [selectedRoute];

	return targets
		.map((r) => {
			const rRows =
				selectedRoute.id === 'ALL'
					? dispatchRows.filter((row) => row.route_id === r.id)
					: dispatchRows;
			if (!rRows.length) return null;
			return {
				target_date: dateKey,
				route_master_id: r.id,
				status,
				rows: rRows.map((row) => ({
					timetable_id: row.timetable_id,
					driver_name: row.driver_name || null,
					tomorrow_driver_name: row.tomorrow_driver_name || null,
					vehicle_no: row.vehicle_no || null,
					start_time: row.start_time || null,
					memo: row.memo || null
				}))
			};
		})
		.filter((p): p is NonNullable<typeof p> => p !== null);
}
