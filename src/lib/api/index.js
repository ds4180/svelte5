import { env } from '$env/dynamic/public';
import { auth } from '$lib/runes/auth.svelte.js';
import { browser } from '$app/environment';

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
	
	// 브라우저에서는 상대 경로를 사용하여 SvelteKit / Nginx 프록시 라우팅을 타게 함
	// 서버 렌더링 시에만 PUBLIC_SERVER_URL(예: http://fastapi:8000) 사용 허용
	let _url = browser ? url : (PUBLIC_SERVER_URL + url);
	
	let body = undefined;
	const headers = {};

	// 1. 요청 타입에 따른 본문 및 헤더 처리
	if (method.toLowerCase() === 'get') {
		// GET 요청: 본문 없음, 파라미터를 쿼리 스트링으로 변환
		if (params && Object.keys(params).length > 0 && !(params instanceof FormData)) {
			const query = new URLSearchParams(params).toString();
			if (query) {
				const separator = _url.includes('?') ? '&' : '?';
				_url = `${_url}${separator}${query}`;
			}
		}
	} else if (params instanceof FormData) {
		// 파일 업로드: 브라우저가 자동으로 Boundary와 Content-Type을 설정하도록 함
		body = params;
	} else {
		// 일반 POST/PUT 등: JSON 처리
		headers['Content-Type'] = 'application/json';
		body = JSON.stringify(params);
	}

	const options = {
		method: method,
		headers: headers,
		body: body,
		credentials: 'include'
	};

	try {
		console.log(`[API Request] ${method} ${_url}`);
		const response = await fetch(_url, options);
		console.log(`[API Response] ${response.status} ${_url}`);

		// 401 Unauthorized 처리
		if (response.status === 401) {
			console.warn('[API] 401 Unauthorized: 세션 만료');
		}

		// 응답 본문 파싱 (표준 json() 사용)
		let data = {};
		const contentType = response.headers.get('content-type');
		
		try {
			if (contentType && contentType.includes('application/json')) {
				data = await response.json();
			} else {
				const text = await response.text();
				data = text ? { detail: text } : {};
			}
		} catch (parseError) {
			console.warn('[API] Response parsing failed:', parseError);
			data = { detail: '파싱 실패' };
		}

		if (response.ok) {
			if (success_callback) success_callback(data);
			return data;
		} else {
			if (failure_callback) failure_callback(data);
			return Promise.reject(data);
		}
	} catch (error) {
		console.error('[API Network Error]:', error);
		const errorData = { detail: '연결 실패' };
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
