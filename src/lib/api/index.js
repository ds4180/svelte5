import { env } from '$env/dynamic/public';
import { auth } from '$lib/runes/auth.svelte.js';

/**
 * FastAPI 백엔드와 통신하는 중앙 집중형 통신 함수 (표준 v1.1 준수)
 * @param {string} method - HTTP 메서드 (GET, POST 등)
 * @param {string} url - 요청 주소 (예: '/v1/app/board/list')
 * @param {Object} [params] - 요청 본문 데이터 또는 쿼리 파라미터
 * @param {Function} [success_callback] - 성공 시 실행할 콜백 (Legacy 대응)
 * @param {Function} [failure_callback] - 실패 시 실행할 콜백 (Legacy 대응)
 * @returns {Promise<any>} - 서버 응답 데이터
 */
export const fastApi = async (method, url, params = {}, success_callback, failure_callback) => {
	const PUBLIC_SERVER_URL = env.PUBLIC_SERVER_URL || '';
	let _url = PUBLIC_SERVER_URL + url;
	let body = params;

	// 1. 헤더 설정 (세션 기반이므로 토큰 주입 제거)
	const headers = {};
	if (!(params instanceof FormData)) {
		headers['Content-Type'] = 'application/json';
		body = JSON.stringify(params);
	}

	// 2. 메서드 처리
	if (method.toLowerCase() === 'get') {
		const query = new URLSearchParams(params).toString();
		if (query) _url += (url.includes('?') ? '&' : '?') + query;
		body = undefined;
	}

	const options = {
		method: method,
		headers: headers,
		body: body,
		credentials: 'include' // 📌 세션 쿠키 전송 보장
	};

	try {
		const response = await fetch(_url, options);

		// 401 Unauthorized 처리 (세션 만료 시 로그아웃 처리)
		if (response.status === 401) {
			console.warn('[API] 401 Unauthorized: 세션이 만료되었거나 권한이 없습니다.');
			if (browser) {
				// 클라이언트 사이드에서 필요한 후속 조치 (예: 로그인 페이지 이동 등)
			}
		}

		const text = await response.text();
		let json = {};
		if (text) {
			try {
				json = JSON.parse(text);
			} catch (e) {
				// JSON 파싱 실패 시 원문 반환
				json = { detail: text };
			}
		}

		if (response.ok) {
			if (success_callback) success_callback(json);
			return json;
		} else {
			console.error(`[API Error] ${response.status}:`, json);
			if (failure_callback) failure_callback(json);
			return Promise.reject(json);
		}
	} catch (error) {
		const errorData = { detail: '서버 연결에 실패했습니다.' };
		if (failure_callback) failure_callback(errorData);
		return Promise.reject(errorData);
	}
};

/**
 * 기존 프로젝트와의 호환성을 위한 소문자 별칭
 */
export const fastapi = fastApi;

// 기본 내보내기
export default fastApi;
