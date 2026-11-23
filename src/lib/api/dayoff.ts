/**
 * ============================================================================
 * [결근/휴무 및 선착순 정원·정책 API 모듈 (src/lib/api/dayoff.ts)]
 * ============================================================================
 */

import { fastApi } from '$lib/api';

const ADMIN_BASE_URL = '/api/v1/admin';

export type DayoffStatus = 'REQUESTED' | 'APPROVED' | 'REJECTED' | 'CANCELLED' | string;
export type DayoffType = 'ANNUAL' | 'SICK' | 'SPECIAL' | 'OFFICIAL' | string;
export type DayoffWorkType = 'FCFS' | 'APPROVAL' | string;

export interface DayoffEntry {
	id: number;
	user_id: number;
	username: string;
	real_name: string;
	primary_group?: string;
	rank_level?: number;
	work_type?: DayoffWorkType;
	date: string;
	type: DayoffType;
	status: DayoffStatus;
	memo?: string;
	group_id?: string;
	create_date?: string;
}

export interface DayoffPolicy {
	id?: number;
	effective_date: string;
	classify_mode: 'GROUP' | 'RANK' | 'BOTH' | string;
	fcfs_groups: string[];
	fcfs_ranks: number[];
	daily_quota: number;
	max_monthly_count: number;
	max_days_per_request: number;
	min_advance_days: number;
	max_advance_days: number;
	etc: Record<string, any>;
}

export interface DayoffMonthlyQuotaDay {
	date: string;
	quota: number;
	approved_count: number;
	remaining: number;
	is_full: boolean;
	is_override: boolean;
	effective_date?: string;
}

export interface DayoffPolicyResponse {
	today_policy?: DayoffPolicy;
	policy?: DayoffPolicy;
	reserved_policy?: DayoffPolicy | null;
	date_overrides?: Record<string, number>;
	available_groups?: string[];
	monthly_quota?: {
		days?: Record<string, DayoffMonthlyQuotaDay>;
	};
}

export const adminGetAllDayoffs = <T = DayoffEntry[]>() =>
	fastApi<T>('GET', `${ADMIN_BASE_URL}/dayoffs`);

export const adminUpdateDayoffStatus = <T = any>(dayoffId: number | string, status: string) =>
	fastApi<T>('PUT', `${ADMIN_BASE_URL}/dayoffs/${dayoffId}/status`, { status });

export const adminGetDayoffPolicy = <T = DayoffPolicyResponse>(year?: number, month?: number) => {
	const qs = new URLSearchParams();
	if (year !== undefined) qs.set('year', String(year));
	if (month !== undefined) qs.set('month', String(month));
	const queryStr = qs.toString();
	return fastApi<T>('GET', `${ADMIN_BASE_URL}/dayoff-policy${queryStr ? `?${queryStr}` : ''}`);
};

export const adminUpdateDayoffPolicy = <T = any>(data: Record<string, any>) =>
	fastApi<T>('PUT', `${ADMIN_BASE_URL}/dayoff-policy`, data);

export const adminDeleteDayoffPolicyRow = <T = any>(policyId: number) =>
	fastApi<T>('DELETE', `${ADMIN_BASE_URL}/dayoff-policy/${policyId}`);

export const adminUpdateDayoffDateOverride = <T = { date_overrides?: Record<string, number> }>(
	dates: string[],
	quota: number | null
) => fastApi<T>('PUT', `${ADMIN_BASE_URL}/dayoff-policy/date-override`, { dates, quota });
