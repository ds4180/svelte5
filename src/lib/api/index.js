import { env } from '$env/dynamic/public';
import { auth } from '$lib/runes/auth.svelte.js';
import { toast } from '$lib/runes/toast.svelte.js';
import { browser } from '$app/environment';

/**
 * ============================================================================
 * [중앙 집중형 API 통신 코어 엔진 (lib/api/index.js)]
 * ============================================================================
 * 
 * 💡 이 파일의 역할:
 * 시스템의 모든 도메인 앱이 백엔드(FastAPI)와 통신할 때 거치는 '유일한 중앙 관문(Proxy)'입니다.
 * 
 * 🌟 핵심 안전장치 (보강 2 적용):
 * 1. [Trailing Slash 자동 교정]: 주소 끝에 실수로 `/`가 붙어 307 리다이렉트 에러가 나는 것을 자동 제거하여 방지합니다.
 * 2. [차등 타임아웃 (AbortController)]: 일반 JSON 요청은 15초, 대용량 파일 업로드(FormData)는 120초 타임아웃을 적용해 무한 로딩을 막습니다.
 * 3. [401 세션 만료 스마트 방어]: 로그인 중이던 사용자의 세션이 만료되거나 다른 기기 접속으로 추방(KICKED_OUT)된 경우에만
 *    안전하게 세션을 비우고(auth.clear) 로그인 페이지로 안내합니다. (비로그인 공개 페이지 무한 루프 방지)
 * 
 * @param {string} method - HTTP 메서드 (GET, POST, PUT, DELETE 등)
 * @param {string} url - 요청 주소 (예: '/api/v1/app/board/list')
 * @param {Object} [params] - 요청 본문 데이터 또는 쿼리 파라미터
 * @param {Function} [success_callback] - 성공 시 실행할 콜백 (Legacy 호환용)
 * @param {Function} [failure_callback] - 실패 시 실행할 콜백 (Legacy 호환용)
 * @returns {Promise<any>} - 서버 응답 데이터
 */
export const fastApi = async (method, url, params = {}, success_callback, failure_callback) => {
	const PUBLIC_SERVER_URL = env.PUBLIC_SERVER_URL || '';

	// 🛡️ [안전장치 1] Trailing Slash(/) 자동 제거 (307 Temporary Redirect 원천 차단)
	const [rawPath, existingQuery] = (url || '').split('?');
	const cleanPath = rawPath.length > 1 ? rawPath.replace(/\/+$/, '') : rawPath;
	const normalizedUrl = existingQuery ? `${cleanPath}?${existingQuery}` : cleanPath;

	// 브라우저에서는 상대 경로를 사용하여 SvelteKit / Nginx 프록시 라우팅을 타게 함
	// 서버 렌더링(SSR) 시에만 PUBLIC_SERVER_URL 사용 허용
	let _url = browser ? normalizedUrl : PUBLIC_SERVER_URL + normalizedUrl;

	let body = undefined;
	const headers = {};
	const isFormData = typeof FormData !== 'undefined' && params instanceof FormData;

	// 1. 요청 타입에 따른 본문 및 헤더 처리
	if (method.toLowerCase() === 'get') {
		// GET 요청: 본문 없음, 파라미터를 쿼리 스트링으로 변환
		if (params && Object.keys(params).length > 0 && !isFormData) {
			const query = new URLSearchParams(params).toString();
			if (query) {
				const separator = _url.includes('?') ? '&' : '?';
				_url = `${_url}${separator}${query}`;
			}
		}
	} else if (isFormData) {
		// 파일 업로드: 브라우저가 자동으로 Boundary와 Content-Type을 설정하도록 함
		body = params;
	} else {
		// 일반 POST/PUT/DELETE 등: JSON 처리
		headers['Content-Type'] = 'application/json';
		body = JSON.stringify(params);
	}

	// 🛡️ [안전장치 2] 차등 타임아웃 제어 (일반 API: 15초, 파일 업로드 FormData: 120초)
	const controller = new AbortController();
	const timeoutMs = isFormData ? 120000 : 15000;
	const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

	const options = {
		method: method,
		headers: headers,
		body: body,
		credentials: 'include',
		signal: controller.signal
	};

	try {
		console.log(`[API Request] ${method} ${_url}`);
		const response = await fetch(_url, options);
		console.log(`[API Response] ${response.status} ${_url}`);

		// 🛡️ [안전장치 3] 401 Unauthorized (세션 만료 또는 중복 로그인 추방) 처리
		if (response.status === 401) {
			console.warn('[API] 401 Unauthorized: 인증 실패 또는 세션 만료');
			const isLoginAttempt = normalizedUrl.includes('/users/login');

			// 브라우저에서 '원래 로그인 상태였던 사용자'가 401을 받은 경우에만 세션 정리 및 로그인 이동
			// (비로그인 손님이 공개 페이지를 볼 때는 무한 리다이렉트가 발생하지 않도록 보호)
			if (browser && !isLoginAttempt && auth.user) {
				auth.clear();
				// 🍞 사내 공지 배너 대신 시스템 기본 알림(Toast)으로 가볍게 안내
				toast.warning('세션이 만료되었거나 다른 기기에서 로그인하여 접속이 종료되었습니다.');
				if (!window.location.pathname.startsWith('/login')) {
					setTimeout(() => {
						window.location.href = '/login';
					}, 800);
				}
			}
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
			data = { detail: '응답 데이터 파싱 실패' };
		}

		if (response.ok) {
			if (success_callback) success_callback(data);
			return data;
		} else {
			// 🛡️ 표준 에러 메시지 추출 (data.error.message -> data.detail 순서로 안전 추출)
			const errMsg = 
				(typeof data.error?.message === 'string' && data.error.message) ||
				(typeof data.detail === 'string' && data.detail) ||
				'';

			// [403 권한 거부]: 별도 콜백이 없으면 시스템 경고 알림(Toast) 표시
			if (browser && response.status === 403 && !failure_callback) {
				toast.warning(errMsg || '해당 기능에 접근할 권한이 없습니다.');
			}
			// [500 서버 장애]: 별도 콜백이 없으면 시스템 에러 알림(Toast) 표시
			else if (browser && response.status >= 500 && !failure_callback) {
				toast.error(errMsg || '서버 내부 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.');
			}

			if (failure_callback) failure_callback(data);
			return Promise.reject(data);
		}
	} catch (error) {
		const isTimeout = error && error.name === 'AbortError';
		const errorMessage = isTimeout
			? '서버 응답 시간이 초과되었습니다. 네트워크 상태를 확인해 주세요.'
			: '서버와의 통신에 실패했습니다.';

		console.error('[API Network Error]:', error);
		const errorData = { detail: errorMessage };

		// 🍞 사내 공지 배너 대신 시스템 기본 알림(Toast)으로 에러 표출
		if (browser && !failure_callback) {
			toast.error(errorMessage);
		}
		if (failure_callback) failure_callback(errorData);
		return Promise.reject(errorData);
	} finally {
		// 타이머 메모리 누수 방지를 위해 요청 종료 시 반드시 타이머 해제
		clearTimeout(timeoutId);
	}
};

/**
 * 기존 프로젝트와의 호환성을 위한 소문자 별칭
 */
export const fastapi = fastApi;

// 기본 내보내기
export default fastApi;
