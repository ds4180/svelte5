/**
 * ============================================================================
 * [블랙박스 비디오 관리 API 모듈 (src/lib/api/blackbox.ts)]
 * ============================================================================
 */

import { fastApi } from './index';

const BASE_URL = '/api/v1/custom/blackbox';

function cleanQueryParams(params: Record<string, any> = {}): Record<string, any> {
	const out: Record<string, any> = {};
	for (const [k, v] of Object.entries(params)) {
		if (v !== undefined && v !== null && v !== '') {
			out[k] = v;
		}
	}
	return out;
}

// 1. 운전기사(사용자) API
export const getDriverBlackboxStatus = <T = any>(vehicleNo?: string) =>
	fastApi<T>('GET', `${BASE_URL}/my-status`, cleanQueryParams({ vehicle_no: vehicleNo }));

export const getMyBlackboxRequests = <T = any>() =>
	fastApi<T>('GET', `${BASE_URL}/requests/me`);

export const createBlackboxRequest = <T = any>(data: Record<string, any>) =>
	fastApi<T>('POST', `${BASE_URL}/requests`, data);

// 2. 관리자 관제 API
export const adminGetBlackboxSummary = <T = any>() =>
	fastApi<T>('GET', `${BASE_URL}/admin/summary`);

export const adminGetBlackboxVideos = <T = any>(params: Record<string, any> = {}) =>
	fastApi<T>('GET', `${BASE_URL}/admin/videos`, cleanQueryParams(params));

export const adminCreateBlackboxVideo = <T = any>(data: Record<string, any>) =>
	fastApi<T>('POST', `${BASE_URL}/admin/videos`, data);

export const adminUpdateBlackboxVideo = <T = any>(videoId: number, data: Record<string, any>) =>
	fastApi<T>('PATCH', `${BASE_URL}/admin/videos/${videoId}`, data);

export const adminDeleteBlackboxVideo = <T = any>(videoId: number) =>
	fastApi<T>('DELETE', `${BASE_URL}/admin/videos/${videoId}`);

export const adminMountBlackboxVideo = <T = any>(videoId: number, data: Record<string, any>) =>
	fastApi<T>('POST', `${BASE_URL}/admin/videos/${videoId}/mount`, data);

export const adminUnmountBlackboxVideo = <T = any>(videoId: number, data: Record<string, any> = {}) =>
	fastApi<T>('POST', `${BASE_URL}/admin/videos/${videoId}/unmount`, data);

export const adminReverseLookupUsages = <T = any>(params: Record<string, any> = {}) =>
	fastApi<T>('GET', `${BASE_URL}/admin/usages`, cleanQueryParams(params));

export const adminGetBlackboxDevices = <T = any>(search?: string) =>
	fastApi<T>('GET', `${BASE_URL}/admin/devices`, cleanQueryParams({ search }));

export const adminCreateBlackboxDevice = <T = any>(data: Record<string, any>) =>
	fastApi<T>('POST', `${BASE_URL}/admin/devices`, data);

export const adminUpdateBlackboxDevice = <T = any>(deviceId: number, data: Record<string, any>) =>
	fastApi<T>('PATCH', `${BASE_URL}/admin/devices/${deviceId}`, data);

export const adminDeleteBlackboxDevice = <T = any>(deviceId: number) =>
	fastApi<T>('DELETE', `${BASE_URL}/admin/devices/${deviceId}`);

export const adminGetBlackboxRequests = <T = any>(status?: string) =>
	fastApi<T>('GET', `${BASE_URL}/admin/requests`, status ? { status } : {});

export const adminProcessBlackboxRequest = <T = any>(reqId: number, data: Record<string, any>) =>
	fastApi<T>('POST', `${BASE_URL}/admin/requests/${reqId}/process`, data);
