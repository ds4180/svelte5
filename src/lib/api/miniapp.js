/**
 * ============================================================================
 * [미니앱 통합 액션 피드 API 클라이언트 (miniapp.js)]
 * ============================================================================
 */
import { auth } from '$lib/runes/auth.svelte.js';

async function request(url, method = 'GET', body = null) {
	const headers = { 'Content-Type': 'application/json' };

	let token = auth.accessToken;
	if (!token && typeof localStorage !== 'undefined') {
		token = localStorage.getItem('accessToken');
	}
	if (!token && typeof document !== 'undefined') {
		const matches = document.cookie.match(/access_token=([^;]+)/);
		if (matches) token = matches[1];
	}

	if (token) {
		headers['Authorization'] = `Bearer ${token}`;
	}

	const options = {
		method,
		headers,
		credentials: 'include'
	};
	if (body) options.body = JSON.stringify(body);

	const response = await fetch(url, options);

	if (response.status === 204) return {};
	if (!response.ok) {
		const err = await response.json().catch(() => ({}));
		throw new Error(
			Array.isArray(err.detail)
				? err.detail.map((item) => item.msg || JSON.stringify(item)).join('; ')
				: err.detail || `API 요청 실패 (${response.status})`
		);
	}
	return response.json();
}

/**
 * @function getMiniappCounts
 * @description 상단 헤더 뱃지 및 슬라이더 뱃지용 실시간 미결 건수 조회
 */
export const getMiniappCounts = () =>
	request('/api/v1/miniapps/counts');

/**
 * @function getMiniappItems
 * @description 사용자의 미니앱 액션 피드 목록 조회
 * @param {Object} [params] - { category, status, skip, limit }
 */
export const getMiniappItems = (params = {}) => {
	const query = new URLSearchParams();
	Object.entries(params).forEach(([key, val]) => {
		if (val !== undefined && val !== null && val !== '') {
			query.append(key, val);
		}
	});
	const qs = query.toString();
	return request(`/api/v1/miniapps${qs ? `?${qs}` : ''}`);
};

/**
 * @function createMiniappItem
 * @description 새 메모, 알람, 메시지, 지시사항 등록
 */
export const createMiniappItem = (data) =>
	request('/api/v1/miniapps', 'POST', data);

/**
 * @function updateMiniappItem
 * @description 미니앱 아이템 상태 갱신 (지시사항 완료, 메모 완료 등)
 */
export const updateMiniappItem = (id, data) =>
	request(`/api/v1/miniapps/${id}`, 'PATCH', data);

/**
 * @function deleteMiniappItem
 * @description 미니앱 아이템 삭제
 */
export const deleteMiniappItem = (id) =>
	request(`/api/v1/miniapps/${id}`, 'DELETE');
