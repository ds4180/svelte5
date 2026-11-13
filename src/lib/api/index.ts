import { env } from '$env/dynamic/public';
import { auth } from '$lib/runes/auth.svelte';
import { toast } from '$lib/runes/toast.svelte';
import { offlineSync } from '$lib/runes/offlineSync.svelte.js';
import { browser } from '$app/environment';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'get' | 'post' | 'put' | 'delete' | 'patch';

export interface FastApiOptions {
	offline?: boolean;
	offlineLabel?: string;
}

export interface OfflineFallbackContext {
	method: string;
	url: string;
	params: any;
	offlineEnabled: boolean;
	offlineLabel?: string;
	onSuccess?: (data: any) => void;
}

const WRITE_METHODS = ['post', 'put', 'delete', 'patch'];
// 보안 가드레일: 인증/세션 엔드포인트는 호출부 옵션과 무관하게 절대 오프라인 우체통(IndexedDB)에 평문 적재하지 않음
const AUTH_PATH_PATTERNS = ['/users/login', '/users/logout', '/logout'];
let isHandlingUnauthorized = false;

/**
 * 오프라인 폴백 처리 (선제 오프라인 감지 / 네트워크 실패 공통)
 */
async function tryOfflineFallback(
	ctx: OfflineFallbackContext,
	{ allowQueue }: { allowQueue: boolean }
): Promise<{ handled: boolean; result?: any }> {
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
 * [중앙 집중형 Type-Safe API 통신 코어 엔진 (lib/api/index.ts)]
 * ============================================================================
 * 
 * 💡 역할:
 * 시스템의 모든 도메인 앱이 백엔드(FastAPI)와 통신할 때 거치는 '유일한 중앙 관문(Proxy)'입니다.
 * 
 * 🌟 6대 핵심 안전장치:
 * 1. [Trailing Slash 자동 교정]: 주소 끝의 `/`를 자동 제거하여 FastAPI 307 리다이렉트 원천 차단.
 * 2. [차등 타임아웃]: 일반 JSON 요청은 15초, 파일 업로드(FormData)는 120초 타임아웃 적용.
 * 3. [401 스마트 방어]: 로그인 상태였던 사용자의 세션이 만료된 경우에만 안전하게 세션 소거 후 로그인 이동.
 * 4. [표준 에러 규격]: data.error.message -> data.detail 순으로 파싱 및 403 권한 거부 문구 단일화.
 * 5. [2중 오프라인 게이트웨이]: !navigator.onLine 선제 차단 및 네트워크 단절 시 IndexedDB 우체통 보관.
 * 6. [Type-Safe 제네릭]: fastApi<TResponse, TBody> 를 통한 정적 타입 추론 지원.
 */
export async function fastApi<TResponse = any, TBody = unknown>(
	method: HttpMethod,
	url: string,
	params: TBody | FormData | Record<string, any> = {},
	success_callback?: ((data: TResponse) => void) | FastApiOptions,
	failure_callback?: (err: any) => void,
	apiOptions: FastApiOptions = {}
): Promise<TResponse> {
	// 4번째 인자로 옵션 객체를 넘긴 경우 (콜백 없는 신규 호출 방식)
	if (success_callback && typeof success_callback === 'object') {
		apiOptions = success_callback as FastApiOptions;
		success_callback = undefined;
	}
	const { offline: offlineEnabled = true, offlineLabel } = apiOptions;
	const onSuccess = success_callback as ((data: TResponse) => void) | undefined;

	const PUBLIC_SERVER_URL = env.PUBLIC_SERVER_URL || '';

	// 🛡️ [안전장치 1] Trailing Slash(/) 자동 제거 (307 Temporary Redirect 원천 차단)
	const [rawPath, existingQuery] = (url || '').split('?');
	const cleanPath = rawPath.length > 1 ? rawPath.replace(/\/+$/, '') : rawPath;
	const normalizedUrl = existingQuery ? `${cleanPath}?${existingQuery}` : cleanPath;

	// 브라우저에서는 상대 경로를 사용하여 SvelteKit / Nginx 프록시 라우팅을 타게 함
	let _url = browser ? normalizedUrl : PUBLIC_SERVER_URL + normalizedUrl;

	let body: any = undefined;
	const headers: Record<string, string> = {};
	const isFormData = typeof FormData !== 'undefined' && params instanceof FormData;

	// 1. 요청 타입에 따른 본문 및 헤더 처리
	if (method.toLowerCase() === 'get') {
		if (params && Object.keys(params).length > 0 && !isFormData) {
			const query = new URLSearchParams(params as any).toString();
			if (query) {
				const separator = _url.includes('?') ? '&' : '?';
				_url = `${_url}${separator}${query}`;
			}
		}
	} else if (isFormData) {
		body = params;
	} else {
		headers['Content-Type'] = 'application/json';
		body = JSON.stringify(params);
	}

	// 🛡️ [안전장치 2] 차등 타임아웃 제어 (일반 API: 15초, 파일 업로드 FormData: 120초)
	const controller = new AbortController();
	const timeoutMs = isFormData ? 120000 : 15000;
	const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

	const options: RequestInit = {
		method: method,
		headers: headers,
		body: body,
		credentials: 'include',
		signal: controller.signal
	};

	const lowerMethod = method.toLowerCase();
	const offlineCtx: OfflineFallbackContext = {
		method,
		url: _url,
		params,
		offlineEnabled,
		offlineLabel,
		onSuccess
	};

	// 🌟 [선제 오프라인 게이트웨이]: 단말기가 이미 오프라인인 경우 즉시 우체통/캐시로 직행
	if (browser && !navigator.onLine) {
		clearTimeout(timeoutId);
		const fallback = await tryOfflineFallback(offlineCtx, { allowQueue: true });
		if (fallback.handled) return fallback.result as TResponse;
	}

	try {
		console.log(`[API Request] ${method} ${_url}`);
		const response = await fetch(_url, options);
		console.log(`[API Response] ${response.status} ${_url}`);

		// 🛡️ [안전장치 3] 401 Unauthorized (세션 만료 또는 중복 로그인 추방) 처리
		if (response.status === 401) {
			console.warn('[API] 401 Unauthorized: 인증 실패 또는 세션 만료');
			const isLoginAttempt = normalizedUrl.includes('/users/login');

			if (browser && !isLoginAttempt && auth.user) {
				auth.clear();
				if (!isHandlingUnauthorized) {
					isHandlingUnauthorized = true;
					toast.warning('세션이 만료되었거나 다른 기기에서 로그인하여 접속이 종료되었습니다.');
					if (!window.location.pathname.startsWith('/login')) {
						const returnTo = encodeURIComponent(window.location.pathname + window.location.search);
						setTimeout(() => {
							window.location.href = `/login?redirect=${returnTo}`;
						}, 800);
					} else {
						isHandlingUnauthorized = false;
					}
				}
			}
		}

		// 응답 본문 파싱
		let data: any = {};
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
			return data as TResponse;
		} else {
			// [403 권한 거부]: 모든 시스템 앱에서 "접근 권한이 없습니다."로 통일
			if (response.status === 403) {
				const simpleMsg = '접근 권한이 없습니다.';
				if (browser && !failure_callback) {
					toast.warning(simpleMsg);
				}

				const errObj: any = new Error(simpleMsg);
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
				(Array.isArray(data.detail) ? data.detail.map((item: any) => item.msg || JSON.stringify(item)).join('; ') : data.detail) ||
				`API 요청 실패 (${response.status})`;

			// [500 서버 장애]: 별도 콜백이 없으면 시스템 에러 토스트 표시
			if (browser && response.status >= 500 && !failure_callback) {
				toast.error(errMsg || '서버 내부 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.');
			}

			const errObj: any = new Error(errMsg);
			Object.assign(errObj, data, { status: response.status, detail: errMsg });

			if (failure_callback) failure_callback(errObj);
			return Promise.reject(errObj);
		}
	} catch (rawError: any) {
		const error = rawError;
		const isTimeout = error && error.name === 'AbortError';
		const isNetworkError = error && error.name === 'TypeError';

		// 🌟 [안전장치 5: 오프라인 게이트웨이] 네트워크 단절/타임아웃 시 캐시 복원 / 우체통 보관
		if (browser && (isNetworkError || isTimeout)) {
			const fallback = await tryOfflineFallback(offlineCtx, { allowQueue: isNetworkError });
			if (fallback.handled) return fallback.result as TResponse;
		}

		const errorMessage = isTimeout
			? '서버 응답 시간이 초과되었습니다. 네트워크 상태를 확인해 주세요.'
			: (error && error.message) || '서버와의 통신에 실패했습니다.';

		console.error('[API Network Error]:', error);
		const errorObj: any = error instanceof Error ? error : new Error(errorMessage);
		errorObj.detail = errorObj.detail || errorMessage;

		if (browser && !failure_callback) {
			toast.error(errorMessage);
		}
		if (failure_callback) failure_callback(errorObj);
		return Promise.reject(errorObj);
	} finally {
		clearTimeout(timeoutId);
	}
}

/**
 * 기존 프로젝트와의 호환성을 위한 소문자 별칭
 */
export const fastapi = fastApi;

// 기본 내보내기
export default fastApi;
