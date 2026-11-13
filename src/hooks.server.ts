import type { Handle, HandleFetch } from '@sveltejs/kit';
import { PUBLIC_API_ENDPOINT } from '$env/static/public';
import {
	SESSION_COOKIE_OPTIONS,
	syncSessionCookieFromResponse,
	buildBackendForwardHeaders
} from '$lib/server/sessionCookie';

/**
 * @file hooks.server.ts (Performance Optimized v3.1)
 */
export const handle: Handle = async ({ event, resolve }) => {
	const start = Date.now();
	const sessionId = event.cookies.get('session_id');
	const pathname = event.url.pathname;

	// 📌 1. 정적 파일 및 특정 경로는 세션 체크 제외 (속도 향상)
	const isStaticAsset = pathname.includes('.') || pathname.startsWith('/_app');
	const isAuthPath = pathname.startsWith('/login') || pathname.startsWith('/logout');

	if (sessionId && !isStaticAsset && !isAuthPath) {
		try {
			// 이미 locals에 유저 정보가 있는지 확인 (중복 호출 방지)
			if (!event.locals.user) {
				const response = await event.fetch(`/api/users/me`);
				if (response.ok) {
					event.locals.user = await response.json();
				} else if (response.status === 401) {
					event.cookies.delete('session_id', SESSION_COOKIE_OPTIONS);
				}
			}
		} catch (e) {
			console.error('❌ [Hooks] Revalidation Error:', e instanceof Error ? e.message : String(e));
		}
	}

	const response = await resolve(event);

	// 📌 실행 시간 로그 (지연 원인 파악용)
	const duration = Date.now() - start;
	if (duration > 100) {
		// 100ms 이상 걸릴 때만 출력
		console.log(`⏱️ [Hooks] Slow Request: ${pathname} took ${duration}ms`);
	}

	return response;
};

export const handleFetch: HandleFetch = async ({ request, fetch, event }) => {
	const apiEndpoint = PUBLIC_API_ENDPOINT || 'http://backend:8000';
	let internalUrl = request.url;

	if (
		request.url.includes('/api') ||
		request.url.startsWith('/users') ||
		request.url.startsWith('/admin')
	) {
		const urlObj = new URL(request.url, 'http://localhost');
		const newPathname = urlObj.pathname.replace(/^\/api/, '');
		internalUrl = `${apiEndpoint}${newPathname}${urlObj.search}`;
	}

	const newRequest = new Request(internalUrl, request);

	// 🛡️ [보안 강화 2]: 브라우저의 Cookie, User-Agent 및 실제 클라이언트 IP(X-Forwarded-For / X-Real-IP)를
	// 백엔드 FastAPI로 손실 없이 전파하여 모바일/PC 세션 바인딩 검증과 감사로그 실제 IP 기록을 보장합니다.
	let clientIp: string | null = null;
	try {
		clientIp = event.getClientAddress();
	} catch {
		clientIp = null;
	}
	const forwardHeaders = buildBackendForwardHeaders(event.request, clientIp);
	for (const [key, value] of Object.entries(forwardHeaders)) {
		newRequest.headers.set(key, value);
	}

	const res = await fetch(newRequest);

	// [Sliding Window] 백엔드 Set-Cookie(session_id + Max-Age) 또는 삭제 지시를 브라우저 응답에 동기화
	syncSessionCookieFromResponse(event.cookies, res);

	return res;
};
