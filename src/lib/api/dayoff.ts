/**
 * ============================================================================
 * [결근/휴무 및 선착순 정원·정책 API 모듈 (src/lib/api/dayoff.ts)]
 * ============================================================================
 */

import { fastApi } from '$lib/api';

const ADMIN_BASE_URL = '/api/v1/admin';

export const adminGetAllDayoffs = <T = any>() =>
	fastApi<T>('GET', `${ADMIN_BASE_URL}/dayoffs`);

export const adminUpdateDayoffStatus = <T = any>(dayoffId: number | string, status: string) =>
	fastApi<T>('PUT', `${ADMIN_BASE_URL}/dayoffs/${dayoffId}/status`, { status });

export const adminGetDayoffPolicy = <T = any>(year?: number, month?: number) => {
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

export const adminUpdateDayoffDateOverride = <T = any>(dates: string[], quota: number | null) =>
	fastApi<T>('PUT', `${ADMIN_BASE_URL}/dayoff-policy/date-override`, { dates, quota });
