/**
 * ============================================================================
 * [휴무/결근계 도메인 공통 TypeScript 타입 정의 (src/lib/types/dayoff.ts)]
 * ============================================================================
 * 💡 사용자 화면(/v1/custom/dayoff) 및 관리자 화면(/v1/admin/dayoff)에서 공통 참조합니다.
 */

export type DayoffType = 'ANNUAL' | 'SICK' | 'SPECIAL' | 'OFFICIAL' | string;
export type DayoffStatus = 'REQUESTED' | 'APPROVED' | 'REJECTED' | 'CANCELLED' | string;
export type DayoffUserMode = 'FCFS' | 'APPROVAL' | string;

export interface DayoffEntry {
	id: number;
	user_id?: number;
	username?: string | null;
	date: string;
	start_date?: string | null;
	end_date?: string | null;
	group_id?: string | null;
	type: DayoffType;
	status: DayoffStatus;
	memo?: string | null;
	created_at?: string | null;
	[key: string]: unknown;
}

export interface DayoffPolicy {
	daily_quota: number;
	max_monthly_count: number;
	max_days_per_request: number;
	min_advance_days: number;
	max_advance_days: number;
	[key: string]: unknown;
}

export interface DayoffQuotaDay {
	date: string;
	quota: number;
	approved_count: number;
	remaining: number;
	is_full: boolean;
	is_override?: boolean;
}

export interface DayoffRequestWindow {
	min_date?: string | null;
	max_date?: string | null;
	min_advance_days?: number;
	max_advance_days?: number;
}

export interface DayoffQuotaStatus {
	year: number;
	month: number;
	user_mode?: DayoffUserMode;
	policy?: DayoffPolicy;
	today_policy?: DayoffPolicy;
	request_window?: DayoffRequestWindow | null;
	monthly_used_count?: number;
	days?: Record<string, DayoffQuotaDay>;
	[key: string]: unknown;
}
