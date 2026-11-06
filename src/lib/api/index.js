import { env } from '$env/dynamic/public';
import { auth } from '$lib/runes/auth.svelte.js';
import { toast } from '$lib/runes/toast.svelte.js';
import { offlineSync } from '$lib/runes/offlineSync.svelte.js';
import { browser } from '$app/environment';

/**
 * @typedef {Object} FastApiOptions
 * @property {boolean} [offline=true] - false 이면 오프라인 시 우체통 적재/GET 캐시 복원을 하지 않음
 * @property {string} [offlineLabel] - 우체통 대기 목록에 표시할 작업 이름
 */

const WRITE_METHODS = ['post', 'put', 'delete', 'patch'];
// 보안 가드레일: 인증/세션 엔드포인트는 호출부 옵션과 무관하게 절대 오프라인 우체통(IndexedDB)에 평문 적재하지 않음
const AUTH_PATH_PATTERNS = ['/users/login', '/users/logout', '/logout'];

/**
 * 오프라인 폴백 처리 (선제 오프라인 감지 / 네트워크 실패 공통)
 * - GET: IndexedDB 에 기억된 마지막 응답 반환
 * - 쓰기: 임시 우체통(Outbox)에 보관 후 queued 결과 반환
 * @param {{ method: string, url: string, params: any, offlineEnabled: boolean, offlineLabel?: string, onSuccess?: Function }} ctx
 * @param {{ allowQueue: boolean }} opts
 * @returns {Promise<{ handled: boolean, result?: any }>}
 */
async function tryOfflineFallback(ctx, { allowQueue }) {
	const { method, url, params, offlineEnabled, offlineLabel, onSuccess } = ctx;
	if (!offlineEnabled || AUTH_PATH_PATTERNS.some((p) => url.includes(p))) {
		return { handled: false };
	}
	const lowerMethod = method.toLowerCase();

	if (lowerMethod === 'get') {
		const cachedData = await offlineSync.loadGetCache(url);
		if (cachedData === null || cachedData === undefined) return { handled: false };
		console.log(`📂 [API Offline Cache Hit] 오프라인 기억 데이터 복원: ${url}`);
		if (onSuccess) onSuccess(cachedData);
		return { handled: true, result: cachedData };
	}

	if (allowQueue && WRITE_METHODS.includes(lowerMethod)) {
		const queued = await offlineSync.enqueue(method, url, params, offlineLabel);
		if (!queued) return { handled: false };
		console.log(`📮 [API Offline Outbox] 임시 우체통 보관 완료: ${method} ${url}`);
		toast.info('📮 오프라인 우체통에 안전하게 보관되었습니다! (인터넷 연결 시 자동 등록됩니다)', 4500);
		const queuedResult = {
			offline_queued: true,
			id: `offline_${Date.now()}`,
			status: 'queued',
			message: '오프라인 임시 우체통 보관 완료'
		};
		if (onSuccess) onSuccess(queuedResult);
		return { handled: true, result: queuedResult };
	}

	return { handled: false };
}

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
 * @param {Function | FastApiOptions} [success_callback] - 성공 시 실행할 콜백 (Legacy 호환용) 또는 옵션 객체
 * @param {Function} [failure_callback] - 실패 시 실행할 콜백 (Legacy 호환용)
 * @param {FastApiOptions} [apiOptions] - 요청 옵션 (콜백을 쓰는 레거시 호출용 6번째 인자)
 * @returns {Promise<any>} - 서버 응답 데이터
 *
 * @example
 * // 오프라인 우체통 적재 제외 (예: 서버 즉시 확인이 필요한 요청)
 * await fastApi('POST', '/api/media/admin/folder/create', data, { offline: false });
 * // 우체통 대기 목록에 표시할 작업 이름 지정
 * await fastApi('POST', url, formData, { offlineLabel: '📷 내 파일함 업로드' });
 */
export const fastApi = async (
	method,
	url,
	params = {},
	success_callback,
	failure_callback,
	apiOptions = {}
) => {
	// 4번째 인자로 옵션 객체를 넘긴 경우 (콜백 없는 신규 호출 방식)
	if (success_callback && typeof success_callback === 'object') {
		apiOptions = /** @type {FastApiOptions} */ (success_callback);
		success_callback = undefined;
	}
	const { offline: offlineEnabled = true, offlineLabel } = /** @type {FastApiOptions} */ (apiOptions);
	const onSuccess = /** @type {Function | undefined} */ (success_callback);
	const PUBLIC_SERVER_URL = env.PUBLIC_SERVER_URL || '';

	// 🛡️ [안전장치 1] Trailing Slash(/) 자동 제거 (307 Temporary Redirect 원천 차단)
	const [rawPath, existingQuery] = (url || '').split('?');
	const cleanPath = rawPath.length > 1 ? rawPath.replace(/\/+$/, '') : rawPath;
	const normalizedUrl = existingQuery ? `${cleanPath}?${existingQuery}` : cleanPath;

	// 브라우저에서는 상대 경로를 사용하여 SvelteKit / Nginx 프록시 라우팅을 타게 함
	// 서버 렌더링(SSR) 시에만 PUBLIC_SERVER_URL 사용 허용
	let _url = browser ? normalizedUrl : PUBLIC_SERVER_URL + normalizedUrl;

	let body = undefined;
	/** @type {Record<string, string>} */
	const headers = {};
	const isFormData = typeof FormData !== 'undefined' && params instanceof FormData;

	// 1. 요청 타입에 따른 본문 및 헤더 처리
	if (method.toLowerCase() === 'get') {
		// GET 요청: 본문 없음, 파라미터를 쿼리 스트링으로 변환
		if (params && Object.keys(params).length > 0 && !isFormData) {
			const query = new URLSearchParams(/** @type {any} */ (params)).toString();
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

	/** @type {RequestInit} */
	const options = {
		method: method,
		headers: headers,
		body: body,
		credentials: /** @type {RequestCredentials} */ ('include'),
		signal: controller.signal
	};

	const lowerMethod = method.toLowerCase();
	const offlineCtx = { method, url: _url, params, offlineEnabled, offlineLabel, onSuccess };

	// 🌟 [선제 오프라인 게이트웨이]: 단말기가 이미 오프라인(!navigator.onLine)인 경우 불필요한 네트워크 에러 없이 즉시 우체통/캐시로 직행
	if (browser && !navigator.onLine) {
		clearTimeout(timeoutId);
		const fallback = await tryOfflineFallback(offlineCtx, { allowQueue: true });
		if (fallback.handled) return fallback.result;
	}

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
		/** @type {any} */
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
			// 💾 [안전장치 4: 오프라인 읽기 기억소] 온라인 GET 조회 성공 시 자동으로 IndexedDB에 캐싱
			if (browser && lowerMethod === 'get') {
				offlineSync.saveGetCache(_url, data);
			}
			if (onSuccess) onSuccess(data);
			return data;
		} else {
			// [403 권한 거부]: 모든 시스템 앱에서 복잡한 내부 사유 대신 '접근 권한이 없습니다.' 단일 통일
			if (response.status === 403) {
				const simpleMsg = '접근 권한이 없습니다.';
				if (browser && !failure_callback) {
					toast.warning(simpleMsg);
				}

				const errObj = /** @type {any} */ (new Error(simpleMsg));
				Object.assign(errObj, data, {
					status: 403,
					detail: simpleMsg,
					isPermissionError: true,
					handledByGateway: true
				});

				if (failure_callback) failure_callback(errObj);
				return Promise.reject(errObj);
			}

			// 🛡️ 표준 에러 메시지 추출 (data.error.message -> data.detail 순서로 안전 추출)
			const errMsg = 
				(typeof data.error?.message === 'string' && data.error.message) ||
				(Array.isArray(data.detail) ? data.detail.map((/** @type {any} */ item) => item.msg || JSON.stringify(item)).join('; ') : data.detail) ||
				`API 요청 실패 (${response.status})`;

			// [500 서버 장애]: 별도 콜백이 없으면 시스템 에러 알림(Toast) 표시
			if (browser && response.status >= 500 && !failure_callback) {
				toast.error(errMsg || '서버 내부 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.');
			}

			// 🌟 컴포넌트 catch(e)에서 e.message / e.detail / e.error 모두 접근 가능하도록 Error 인스턴스 보장
			const errObj = /** @type {any} */ (new Error(errMsg));
			Object.assign(errObj, data, { status: response.status, detail: errMsg });

			if (failure_callback) failure_callback(errObj);
			return Promise.reject(errObj);
		}
	} catch (rawError) {
		const error = /** @type {any} */ (rawError);
		const isTimeout = error && error.name === 'AbortError';
		// fetch() 자체가 네트워크 단절로 실패하면 TypeError 를 던짐 (응답 파싱 오류 등과 구분)
		const isNetworkError = error && error.name === 'TypeError';

		// 🌟 [안전장치 5: 오프라인 게이트웨이] 네트워크 단절/타임아웃 시 캐시 복원 / 우체통 보관
		// ⚠️ 타임아웃(AbortError)은 서버가 이미 처리했을 수 있으므로 쓰기 요청을 우체통에 넣지 않음 (중복 등록 방지)
		if (browser && (isNetworkError || isTimeout)) {
			const fallback = await tryOfflineFallback(offlineCtx, { allowQueue: isNetworkError });
			if (fallback.handled) return fallback.result;
		}

		const errorMessage = isTimeout
			? '서버 응답 시간이 초과되었습니다. 네트워크 상태를 확인해 주세요.'
			: (error && error.message) || '서버와의 통신에 실패했습니다.';

		console.error('[API Network Error]:', error);
		const errorObj = /** @type {any} */ (error instanceof Error ? error : new Error(errorMessage));
		errorObj.detail = errorObj.detail || errorMessage;

		// 🍞 사내 공지 배너 대신 시스템 기본 알림(Toast)으로 에러 표출
		if (browser && !failure_callback) {
			toast.error(errorMessage);
		}
		if (failure_callback) failure_callback(errorObj);
		return Promise.reject(errorObj);
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
