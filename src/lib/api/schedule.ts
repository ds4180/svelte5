/**
 * ============================================================================
 * [통합 일정 및 사무실·개인 결근계 연동 API 모듈 (src/lib/api/schedule.ts)]
 * ============================================================================
 */

import { fastApi } from '$lib/api';

const BASE_URL = '/api/v1/schedule';

export const getSchedules = <T = any>(params: {
	year?: number;
	month?: number;
	start_date?: string;
	end_date?: string;
} = {}) => {
	const clean: Record<string, any> = {};
	for (const [k, v] of Object.entries(params)) {
		if (v !== undefined && v !== null && v !== '') clean[k] = v;
	}
	return fastApi<T>('GET', BASE_URL, clean);
};

export const createSchedule = <T = any>(data: Record<string, any>) =>
	fastApi<T>('POST', BASE_URL, data);

export const updateSchedule = <T = any>(scheduleId: number | string, data: Record<string, any>) =>
	fastApi<T>('PATCH', `${BASE_URL}/${scheduleId}`, data);

export const deleteSchedule = <T = any>(scheduleId: number | string) =>
	fastApi<T>('DELETE', `${BASE_URL}/${scheduleId}`);
